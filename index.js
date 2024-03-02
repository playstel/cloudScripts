//////////////////////////////////////////////////////////////////////////////////////////
//
//  Reward
//
//////////////////////////////////////////////////////////////////////////////////////////

// defining these up top so we can easily change these later if we need to.
var CHECK_IN_TRACKER = "CheckInTracker";    				// used as a key on the UserPublisherReadOnlyData
var PROGRESSIVE_REWARD_TABLE = "ProgressiveRewardTable";	// TitleData key that contains the reward details
var PROGRESSIVE_MIN_CREDITS = "MinStreak";					// PROGRESSIVE_REWARD_TABLE property denoting the minium number of logins to be eligible for this item 
var PROGRESSIVE_REWARD = "Reward";							// PROGRESSIVE_REWARD_TABLE property denoting what item gets rewarded at this level
var TRACKER_NEXT_GRANT = "NextEligibleGrant";				// CHECK_IN_TRACKER property containing the time at which we 
var TRACKER_LOGIN_STREAK = "LoginStreak";					// CHECK_IN_TRACKER property containing the streak length


handlers.CheckIn = function(args) {

    var referralMark = CheckReferralMark();
    var newReferralsIds = CheckNewReferrals();

	var GetUserReadOnlyDataRequest = {
        "PlayFabId": currentPlayerId,
        "Keys": [ CHECK_IN_TRACKER, AD_WATCH_KEY, ADDRESSABLES_VERSION_KEY, AD_STREAK_KEY ]
    }; 
    
    var GetUserReadOnlyDataResponse = server.GetUserReadOnlyData(GetUserReadOnlyDataRequest);
    
    // need to ensure that our data field exists
    var tracker = {}; // this would be the first login ever (across any title), so we have to make sure our record exists.
    
    var ad = false;
    var addressablesVersion = 0;
    var starsStreak = 0;
    var loginStreak = 0;
    var nextGrant = 0;
    
    if(GetUserReadOnlyDataResponse.Data.hasOwnProperty(AD_STREAK_KEY))
    {
    	starsStreak = GetUserReadOnlyDataResponse.Data[AD_STREAK_KEY].Value;
    }
    
    if(GetUserReadOnlyDataResponse.Data.hasOwnProperty(AD_WATCH_KEY))
    {
    	var watchAd = GetUserReadOnlyDataResponse.Data[AD_WATCH_KEY].Value;
    	
    	if (watchAd == "true") ad = true;
    }
    
    if(GetUserReadOnlyDataResponse.Data.hasOwnProperty(ADDRESSABLES_VERSION_KEY))
    {
    	addressablesVersion = GetUserReadOnlyDataResponse.Data[ADDRESSABLES_VERSION_KEY].Value;
    }
    
    if(GetUserReadOnlyDataResponse.Data.hasOwnProperty(CHECK_IN_TRACKER))
    {
    	//tracker = JSON.parse(GetUserReadOnlyDataResponse.Data[CHECK_IN_TRACKER].Value);
    	tracker = GetUserReadOnlyDataResponse.Data[CHECK_IN_TRACKER].Value;
    }
    else
    {
    	tracker = ResetTracker();
  		
  		// write back updated data to PlayFab
  		UpdateTrackerData(tracker);
  		
        GrantItems("Gold Start", "Support");
        
        
        // streak continues
		loginStreak += 1;
		
        if(loginStreak > 7) loginStreak = 1;
		
		var dateObj = new Date(Date.now());
		dateObj.setDate(dateObj.getDate() + 1); // add one day 
		nextGrant = dateObj.getTime();

		// write back updated data to PlayFab
		log.info("Your consecutive login streak increased to: " + loginStreak);
		//UpdateTrackerData(tracker);
		
		UpdateTrackerDataManual(loginStreak, nextGrant);
		
		var bonusName = SetBonus(loginStreak);
		
        return {"currentStreak":loginStreak,"dailyBonus":true,"message":"Daily and first login bonuses is ready!", 
    	    "firstLoginBonus": true,"newReferralsIds":newReferralsIds, "referralMark":referralMark, "ad":ad, 
    	    "addressablesVersion" : addressablesVersion, "starsStreak":starsStreak };

    // 	return {"currentStreak":tracker[TRACKER_LOGIN_STREAK],"dailyBonus":false,"message":"This was your first login!", 
    // 	    "firstLoginBonus": true,"newReferralsIds":newReferralsIds, "referralMark":referralMark, "ad":ad, 
    // 	    "addressablesVersion" : addressablesVersion, "starsStreak":starsStreak };
    }

    if(tracker != null)
    {
        var values = tracker.split(';');
        
        if(values[0] != NaN)
        {
            loginStreak = parseInt(values[0]);
        }
        
        nextGrant = parseInt(values[1]);
    }

	if(Date.now() > nextGrant)
	{	
		// Eligible for an item grant.
		//check to ensure that it has been less than 24 hours since the last grant window opened
		var timeWindow = new Date(nextGrant);
		timeWindow.setDate(timeWindow.getDate() + 1); // add 1 day 

		if(Date.now() > timeWindow.getTime())
		{
			// streak ended :(			
			tracker = ResetTracker();
			//UpdateTrackerData(tracker);
			
		    UpdateTrackerData(tracker);
        
    	    return {"currentStreak":loginStreak,"dailyBonus":false,"message":"Your daily bonus streak has been broken", 
    	    "firstLoginBonus": false,"newReferralsIds":newReferralsIds, "referralMark":referralMark, "ad":ad, 
    	    "addressablesVersion" : addressablesVersion, "starsStreak":starsStreak };
		}

		// streak continues
		loginStreak += 1;
		
        if(loginStreak > 7) loginStreak = 1;
		
		var dateObj = new Date(Date.now());
		dateObj.setDate(dateObj.getDate() + 1); // add one day 
		nextGrant = dateObj.getTime();

		// write back updated data to PlayFab
		log.info("Your consecutive login streak increased to: " + loginStreak);
		//UpdateTrackerData(tracker);
		
		UpdateTrackerDataManual(loginStreak, nextGrant);
		
		var bonusName = SetBonus(loginStreak);
		
        return {"currentStreak":loginStreak,"dailyBonus":true,"message":"Daily bonus is ready!", 
    	    "firstLoginBonus": false,"newReferralsIds":newReferralsIds, "referralMark":referralMark, "ad":ad, 
    	    "addressablesVersion" : addressablesVersion, "starsStreak":starsStreak };
	}

    return {"currentStreak":loginStreak,"dailyBonus":false,"message":"Daily bonus is not ready yet!", 
    	    "firstLoginBonus": false,"newReferralsIds":newReferralsIds, "referralMark":referralMark, "ad":ad, 
    	    "addressablesVersion" : addressablesVersion, "starsStreak":starsStreak };
};

function SetBonus(Streak) 
{
    var streak = parseInt(Streak);
    
    var bonusName = "Gold Small";
    
    if(streak > 7)
    {
        bonusName = "Gold Medium";
    }
    
    GrantItems(bonusName, "Support");
        
    return bonusName;
}

function ResetTracker()
{
	var dateObj = new Date(Date.now());
	dateObj.setDate(dateObj.getDate() + 1); // add one day 
	
	return 0 + ";" + dateObj.getTime();
}


function UpdateTrackerData(data)
{
    var UpdateUserReadOnlyDataRequest = {
        "PlayFabId": currentPlayerId,
        "Data": {}
    };
    UpdateUserReadOnlyDataRequest.Data[CHECK_IN_TRACKER] = data;

    server.UpdateUserReadOnlyData(UpdateUserReadOnlyDataRequest);
}

function UpdateTrackerDataManual(streak, newDate)
{
    var UpdateUserReadOnlyDataRequest = {
        "PlayFabId": currentPlayerId,
        "Data": {}
    };
    
    if(streak > 7)
    {
        UpdateUserReadOnlyDataRequest.Data[CHECK_IN_TRACKER] = 0 + ";" + newDate;
    }
    else
    {
        UpdateUserReadOnlyDataRequest.Data[CHECK_IN_TRACKER] = streak + ";" + newDate;
    }

    server.UpdateUserReadOnlyData(UpdateUserReadOnlyDataRequest);
}


//////////////////////////////////////////////////////////////////////////////////////////
//
//  Referrer Checkup
//
//////////////////////////////////////////////////////////////////////////////////////////

function CheckNewReferrals()
{
    var GetUserReadOnlyDataRequest = 
    {
        "PlayFabId": currentPlayerId,
        "Keys": [ PLAYER_REFERRAL_TEMPORARY_KEY ]
    }; 
    
    var GetUserReadOnlyDataResult = server.GetUserReadOnlyData(GetUserReadOnlyDataRequest);

    var referralValuesTemporary = [];
    
    if(GetUserReadOnlyDataResult.Data.hasOwnProperty(PLAYER_REFERRAL_TEMPORARY_KEY))
    {
        referralValuesTemporary = JSON.parse(GetUserReadOnlyDataResult.Data[PLAYER_REFERRAL_TEMPORARY_KEY].Value);
        
        if(Array.isArray(referralValuesTemporary))
        {
            var rewardAmount = 0;
            
            if(referralValuesTemporary.length > 0)
            {
                rewardAmount = referralValuesTemporary.length * VIRTUAL_CURRENCY_AMOUNT;
                
                AddCurrency(rewardAmount, VIRTUAL_CURRENCY_CODE);
            }
            
            RemoveTemporaryReferralData();
            
            return referralValuesTemporary;
        }
        else
        {
            return null;
        }
    }
    
    return null;
}

function RemoveTemporaryReferralData()
{
    // Bonus for Referral and his Referrer
    var UpdateUserReadOnlyDataRequest = 
    {
        "PlayFabId": currentPlayerId,
        "Data": {}
    };
    
    UpdateUserReadOnlyDataRequest.Data[PLAYER_REFERRAL_TEMPORARY_KEY] = null;
    
    server.UpdateUserReadOnlyData(UpdateUserReadOnlyDataRequest);
}

function CheckReferralMark()
{
    var GetUserInventoryResult = server.GetUserInventory({ "PlayFabId": currentPlayerId });
        
    for(var index in GetUserInventoryResult.Inventory)
    {
        if(GetUserInventoryResult.Inventory[index].ItemId === REFERRAL_MARK)
        {
            return 1;
        }
    }
        
    return 0;
}

//////////////////////////////////////////////////////////////////////////////////////////
//
//  Referral Programm
//
//////////////////////////////////////////////////////////////////////////////////////////

var VIRTUAL_CURRENCY_CODE = "GL";
var VIRTUAL_CURRENCY_AMOUNT = 1000;
var PLAYER_REFERRAL_KEY = "Referral";
var PLAYER_REFERRAL_TEMPORARY_KEY = "ReferralTemporary";
var MAXIMUM_REFERRALS = 5;
var REFERRAL_BONUS_BUNDLE = "ReferralPack";
var REFERRAL_MARK = "ReferralMark";
var CATALOG_VERSION_REF = "Setup";

// Referral code is PlayFabId of referrer
handlers.RedeemReferral = function(args) {

    try
    {
        // Check Input Correct
        if(args == null || typeof args.referralCode === undefined || args.referralCode === "")
        {
            throw "Failed to redeem. Invite code is undefined or blank";
        }
        
        else if(args.referralCode === currentPlayerId)
        {
            throw "You are not allowed to invite yourself";
        }
        
        // Check Referral Mark
        var GetUserInventoryResult = server.GetUserInventory({ "PlayFabId": currentPlayerId });
        
        for(var index in GetUserInventoryResult.Inventory)
        {
            if(GetUserInventoryResult.Inventory[index].ItemId === REFERRAL_MARK)
            {
                throw "You are only allowed one invite mark";
            }
        }


        // Reward for Referrer
        var GetUserReadOnlyDataRequest = 
        {
            "PlayFabId": args.referralCode,
            "Keys": [ PLAYER_REFERRAL_KEY, PLAYER_REFERRAL_TEMPORARY_KEY ]
        }; 
        
        var GetUserReadOnlyDataResult = server.GetUserReadOnlyData(GetUserReadOnlyDataRequest);
        
        // Referrals list of Referrer 
        var referralValues = [];
        
        
        // If Player has become the Referrer at the First Time
        if(!GetUserReadOnlyDataResult.Data.hasOwnProperty(PLAYER_REFERRAL_KEY))
        {
            referralValues.push(currentPlayerId);
            ProcessReferrer(args.referralCode, referralValues, PLAYER_REFERRAL_KEY);
        }
        
        // If Player already have some referrals
        else
        {
            referralValues = JSON.parse(GetUserReadOnlyDataResult.Data[PLAYER_REFERRAL_KEY].Value);
            
            if(Array.isArray(referralValues))
            {
                // If referrals not too much
                if(referralValues.length < MAXIMUM_REFERRALS)
                {
                    referralValues.push(currentPlayerId);
                    ProcessReferrer(args.referralCode, referralValues, PLAYER_REFERRAL_KEY);
                }
                else
                {
                    return "Your referral has hit the limit of invited friends";
                }
            }
            
            else
            {
                throw "An error occured when parsing the referrer's player data";
            }
        }
        
        
        // Referrals list of Referrer 
        var referralValuesTemporary = [];
        
        // If Player has become the Referrer at the First Time
        if(!GetUserReadOnlyDataResult.Data.hasOwnProperty(PLAYER_REFERRAL_TEMPORARY_KEY))
        {
            referralValuesTemporary.push(currentPlayerId);
            ProcessReferrer(args.referralCode, referralValuesTemporary, PLAYER_REFERRAL_TEMPORARY_KEY);
        }
        
        // If Player already have some referrals
        else
        {
            referralValuesTemporary = JSON.parse(GetUserReadOnlyDataResult.Data[PLAYER_REFERRAL_TEMPORARY_KEY].Value);
            
            if(Array.isArray(referralValuesTemporary))
            {
                // If referrals not too much
                if(referralValuesTemporary.length < MAXIMUM_REFERRALS)
                {
                    referralValuesTemporary.push(currentPlayerId);
                    ProcessReferrer(args.referralCode, referralValuesTemporary, PLAYER_REFERRAL_TEMPORARY_KEY);
                }
                else
                {
                    return "Your referral has hit the limit of invited friends";
                }
            }
            
            else
            {
                throw "An error occured when parsing the referrer's player data";
            }
        }
        
        SetReferralFriend(currentPlayerId, args.referralCode, "Confirmed");
        SetReferralFriend(args.referralCode, currentPlayerId, "Confirmed");
        
        GrantReferralBonus();
        
        return "Success";
    } 
    catch(e) 
    {
        return e;
    }
};


function GrantReferralBonus()
{
    var GrantItemsToUserRequest = 
    {
        "CatalogVersion" : CATALOG_VERSION_REF,
        "PlayFabId" : currentPlayerId,
        "ItemIds" : [ REFERRAL_MARK, REFERRAL_BONUS_BUNDLE ]
    };

    var GrantItemsToUserResult = server.GrantItemsToUser(GrantItemsToUserRequest);
    
    return GrantItemsToUserResult.ItemGrantResults;
}

//////////////////////////////////////////////////////////////////////////////////////////

function ProcessReferrer(id, referrals, key)
{
    // Bonus for Referral and his Referrer
    var UpdateUserReadOnlyDataRequest = 
    {
        "PlayFabId": id,
        "Data": {}
    };
    
    UpdateUserReadOnlyDataRequest.Data[key] = JSON.stringify(referrals);
    
    server.UpdateUserReadOnlyData(UpdateUserReadOnlyDataRequest);
}

function SetReferralFriend(userId, friendId, refTag)
{
    var AddFriendRequest = 
    {
        "PlayFabId": userId,
        "FriendPlayFabId": friendId
    }; 
        
    server.AddFriend(AddFriendRequest);
        
    var referralTags = [];
    referralTags.push(refTag);
    
    var SetFriendTagRequest = 
    {
        "PlayFabId": userId,
        "FriendPlayFabId": friendId,
        "Tags": referralTags
    }; 
        
    server.SetFriendTags(SetFriendTagRequest);
}




//////////////////////////////////////////////////////////////////////////////////////////
//
//  Friends
//
//////////////////////////////////////////////////////////////////////////////////////////

handlers.AddFriend = function(args) {

    var AddFriendRequest = 
    {
        "PlayFabId": args.PlayFabId,
        "FriendPlayFabId": args.FriendId
    }; 
    
    return server.AddFriend(AddFriendRequest);
}

handlers.SetFriendTags = function(args) {

    var SetFriendTagRequest = 
    {
        "PlayFabId": args.PlayFabId,
        "FriendPlayFabId": args.FriendId,
        "Tags": args.FriendTags
    }; 
    
    return server.SetFriendTags(SetFriendTagRequest);
}

handlers.RemoveFriend = function(args) {

    var RemoveFriendRequest = 
    {
        "PlayFabId": args.PlayFabId,
        "FriendPlayFabId": args.FriendId
    }; 
    
    return server.RemoveFriend(RemoveFriendRequest);
}

handlers.GetFriends = function(args) {

    if(args.PlayFabId == currentPlayerId)
    {
        var GetFriendRequest = 
        {
            "PlayFabId": currentPlayerId
        }; 
        
        return server.GetFriendsList(GetFriendRequest);
    }

    var GetFriendRequest = 
    {
        "PlayFabId": args.PlayFabId
    }; 
    
    return server.GetFriendsList(GetFriendRequest);
}

//////////////////////////////////////////////////////////////////////////////////////////
//
//  Currency
//
//////////////////////////////////////////////////////////////////////////////////////////

handlers.UpdateMainCurrency = function(args) {

    var recentCurrencyValue = GetUserCurrency("GL");
    var newCurrencyValue = args.NewCurrencyValue;
    
    var substractedValue = recentCurrencyValue - newCurrencyValue;
    
    if (substractedValue < 0)
    {
        SubstractItemPrice(newCurrencyValue, "GL");
        return null;
    }
    
    return SubstractItemPrice(substractedValue, "GL");
}

function GetUserCurrency(Currency)
{
    var request = { "InfoRequestParameters": { "GetUserVirtualCurrency": true }, "PlayFabId": currentPlayerId };
    return server.GetPlayerCombinedInfo(request).InfoResultPayload.UserVirtualCurrency[Currency];
}


function AddCurrency(Value, Currency)
{
    server.AddUserVirtualCurrency({PlayFabId: currentPlayerId, 
    VirtualCurrency: Currency, Amount: Value});
}

function SubstractItemPrice(Value, Currency)
{
    server.SubtractUserVirtualCurrency({PlayFabId: currentPlayerId, 
    VirtualCurrency: Currency, Amount: Value});
}

//////////////////////////////////////////////////////////////////////////////////////////
//
//  Spin
//
//////////////////////////////////////////////////////////////////////////////////////////

var SPIN_COOLDOWN_SECONDS = 149;

handlers.ProcessSpin = function(args)
{
    var playerMove = "Spin";
    var now = Date.now();
    var playerMoveCooldownInSeconds = SPIN_COOLDOWN_SECONDS;

    var playerData = server.GetUserInternalData({
        PlayFabId: currentPlayerId,
        Keys: ["last_move_timestamp"]
    });

    var lastMoveTimestampSetting = playerData.Data["last_move_timestamp"];

    if (lastMoveTimestampSetting) {
        var lastMoveTime = Date.parse(lastMoveTimestampSetting.Value);
        var timeSinceLastMoveInSeconds = (now - lastMoveTime) / 1000;
        log.debug("lastMoveTime: " + lastMoveTime + " now: " + now + " timeSinceLastMoveInSeconds: " + timeSinceLastMoveInSeconds);

        if (timeSinceLastMoveInSeconds < playerMoveCooldownInSeconds) {
            log.error("Invalid move - time since last move: " + timeSinceLastMoveInSeconds + "s less than minimum of " + playerMoveCooldownInSeconds + "s.");
            return false;
        }
    }

    var playerStats = server.GetPlayerStatistics({
        PlayFabId: currentPlayerId
    }).Statistics;
    var movesMade = 0;
    for (var i = 0; i < playerStats.length; i++)
        if (playerStats[i].StatisticName === "")
            movesMade = playerStats[i].Value;
    movesMade += 1;
    var request = {
        PlayFabId: currentPlayerId, Statistics: [{
                StatisticName: "movesMade",
                Value: movesMade
            }]
    };
    server.UpdatePlayerStatistics(request);
    server.UpdateUserInternalData({
        PlayFabId: currentPlayerId,
        Data: {
            last_move_timestamp: new Date(now).toUTCString(),
            last_move: JSON.stringify(playerMove)
        }
    });

    return true;
}


handlers.GetRouletteCooldown = function(args)
{
    var playerMove = "Spin";
    var now = Date.now();
    var playerMoveCooldownInSeconds = SPIN_COOLDOWN_SECONDS;

    var playerData = server.GetUserInternalData({
        PlayFabId: currentPlayerId,
        Keys: ["last_move_timestamp"]
    });

    var lastMoveTimestampSetting = playerData.Data["last_move_timestamp"];

    if (lastMoveTimestampSetting) {
        var lastMoveTime = Date.parse(lastMoveTimestampSetting.Value);
        var timeSinceLastMoveInSeconds = (now - lastMoveTime) / 1000;
        log.debug("lastMoveTime: " + lastMoveTime + " now: " + now + " timeSinceLastMoveInSeconds: " + timeSinceLastMoveInSeconds);

        var cooldown = playerMoveCooldownInSeconds - timeSinceLastMoveInSeconds;

        if(cooldown > 0) return cooldown;
    }

    return 0.0;
}

//////////////////////////////////////////////////////////////////////////////////////////
//
//  Player data
//
//////////////////////////////////////////////////////////////////////////////////////////

var NEWLY_STATUS_KEY = "Newly";
var NEWLY_STATUS_VALUE = "False";

var SKIN_KEY = "UnitSkin";
var SKIN_START_VALUE = "Material_Chr_01_A";

var DEFAULT_ITEMS_CATALOG = "Character";
var DEFAULT_ITEMS_PACK = "Default Characters";

var DEFAULT_ITEMS_CATALOG_2 = "Market";
var DEFAULT_ITEMS_PACK_2 = "Default Character";

var DEFAULT_ITEMS_DATA_KEY = "Items";
var DEFAULT_ITEMS_DATA_VALUE = "Cool_Male_Hair_01;Cool Male;";

var DISABLE_AD_KEY = "Disable Ads";
var DISABLE_AD_VALUE_DEFAULT = "false";
var DISABLE_AD_VALUE_PURCHASED = "true";

handlers.CreateDefaultPlayerData = function(args)
{ 
    var updatePlayerStatisticsRequest = { PlayFabId: currentPlayerId, Statistics: [
        { StatisticName: "Matches", Value: 0 },
        { StatisticName: "Frags", Value: 0 },
        { StatisticName: "Deaths", Value: 0 },
        { StatisticName: "Referrals", Value: 0 },
        { StatisticName: "Cups", Value: 0 },
        { StatisticName: "GameTime", Value: 0 }
        ]
    };
             
    server.UpdatePlayerStatistics(updatePlayerStatisticsRequest);
    
    var UpdateUserDataRequest = 
    {
        "PlayFabId": currentPlayerId,
        "Data": {},
        "Permission": "Public"
    };
    
    UpdateUserDataRequest.Data[NEWLY_STATUS_KEY] = NEWLY_STATUS_VALUE;
    UpdateUserDataRequest.Data[DEFAULT_ITEMS_DATA_KEY] = DEFAULT_ITEMS_DATA_VALUE;
    UpdateUserDataRequest.Data[SKIN_KEY] = SKIN_START_VALUE;
    UpdateUserDataRequest.Data[DISABLE_AD_KEY] = DISABLE_AD_VALUE_DEFAULT;
    
    server.UpdateUserData(UpdateUserDataRequest);
    
    GrantItems(DEFAULT_ITEMS_PACK, DEFAULT_ITEMS_CATALOG); // delete after update
    GrantItems(DEFAULT_ITEMS_PACK_2, DEFAULT_ITEMS_CATALOG_2); // rename after update
    
    StartGoldPack();
}

var PICKED_ITEMS_KEY = "PickedItems";
handlers.SetPickedItems = function(args)
{ 
    var UpdateUserDataRequest = 
    {
        "PlayFabId": currentPlayerId,
        "Data": {},
    
        "Permission": "Public"
    };
    
    UpdateUserDataRequest.Data[PICKED_ITEMS_KEY] = args.PickedItems;
    
    server.UpdateUserData(UpdateUserDataRequest);
}


var ITEMS_KEY = "Items";

handlers.SetCharacterToUser = function(args)
{
    var inventoryItems = GetPlayerInventory();
    
    var pickedItems = args.PickedItems;
    
    var pickedItemsData = pickedItems.split(';');
    
    var savingItems = "";
    
    for(var index in inventoryItems)
    {
        var inventoryItem = inventoryItems[index];
        
        for(var pickedItem of pickedItemsData)
        {
            if(pickedItem == inventoryItem.DisplayName)
            {
                savingItems += inventoryItem.DisplayName + ";";
            }
        }
    }
    
    var UpdateUserDataRequest = 
    {
        "PlayFabId": currentPlayerId,
        "Data": {},
        "Permission": "Public"
    };
    
    UpdateUserDataRequest.Data[NEWLY_STATUS_KEY] = "False";
    UpdateUserDataRequest.Data[SKIN_KEY] = args.SkinValue;
    UpdateUserDataRequest.Data[ITEMS_KEY] = savingItems;
    
    server.UpdateUserData(UpdateUserDataRequest);
}

//////////////////////////////////////////////////////////////////////////////////////////
//
//  Shop
//
//////////////////////////////////////////////////////////////////////////////////////////

handlers.StartGoldPack = function(args)
{
    return GrantItems("Gold Start", "Support");
}

handlers.SmallGoldPack = function(args)
{
    return GrantItems("Gold Small", "Support");
}

handlers.MediumGoldPack = function(args)
{
    return GrantItems("Gold Medium", "Support");
}

handlers.LargeGoldPack = function(args)
{
    return GrantItems("Gold Large", "Support");
}

//////////////////////////////////////////////////////////////////////////////////////////
//
//  Grant Items
//
//////////////////////////////////////////////////////////////////////////////////////////

handlers.GrantItemsArray = function(args)
{
    var GrantItemsToUserRequest = 
    {
        "CatalogVersion" : args.Catalog,
        "PlayFabId" : currentPlayerId,
        "ItemIds" : args.ItemsArray
    };
    
    return server.GrantItemsToUser(GrantItemsToUserRequest).ItemGrantResults;
}

function GrantItems(ItemId, Catalog)
{
    var GrantWeaponsToUserRequest = 
    {
        "CatalogVersion" : Catalog,
        "PlayFabId" : currentPlayerId,
        "ItemIds" : [ ItemId ]
    };
    
    return server.GrantItemsToUser(GrantWeaponsToUserRequest);
}

//////////////////////////////////////////////////////////////////////////////////////////
//
//  Session Items
//
//////////////////////////////////////////////////////////////////////////////////////////

var requiredUserDataKey = "Items";

handlers.GetSessionItems = function(args)
{
    var inventoryItems = GetPlayerInventory();
    
    var pickedItems = GetPlayerDataValue(requiredUserDataKey);
    
    var pickedItemsData = pickedItems.split(';');
    
    var sessionItems = [];
    
    for(var index in inventoryItems)
    {
        var inventoryItem = inventoryItems[index];
        
        for(var pickedItem of pickedItemsData)
        {
            if(pickedItem == inventoryItem.DisplayName)
            {
                sessionItems.push(inventoryItem.DisplayName);
            }
        }
    }
    
    return sessionItems;
}

function GetPlayerInventory() 
{
    return server.GetUserInventory({ "PlayFabId": currentPlayerId }).Inventory;
}

function GetPlayerDataValue(key) 
{
    var getPlayerInfo = server.GetUserData
        ({
            PlayFabId: currentPlayerId,
            Keys: [ key ],
        });
        
    return getPlayerInfo.Data[key].Value;
}

//////////////////////////////////////////////////////////////////////////////////////////
//
//  Purchase Items
//
//////////////////////////////////////////////////////////////////////////////////////////

handlers.BuyInventoryItem = function(args)
{
    var success = PayForItem(args.ItemId, args.CatalogVersion, true, args.CurrencyName);
    
    if(success)
    {
        GrantItems(args.ItemId, args.CatalogVersion);
        return true;
    }
    else
    {
        return false;
    }
}

handlers.UserCanBuyItem = function(args)
{
    return PayForItem(args.ItemId, args.CatalogVersion, true, args.CurrencyName);
}    
    
function PayForItem(itemId, catalogVersion, substractPrice, currencyName) 
{
    var GetCatalogItemsResult = server.GetCatalogItems({ CatalogVersion: catalogVersion });
    
    var itemPrice = 0;
    
    for(var catalogItem in GetCatalogItemsResult.Catalog)
    {
        var item = GetCatalogItemsResult.Catalog[catalogItem];
        
        if(item.ItemId == itemId)
        {
            itemPrice = item.VirtualCurrencyPrices[currencyName];
        }
    }
    
    var request = { "InfoRequestParameters": { "GetUserVirtualCurrency": true }, "PlayFabId": currentPlayerId };
    var currencyAmount = server.GetPlayerCombinedInfo(request).InfoResultPayload.UserVirtualCurrency[currencyName];
    
    var success = itemPrice > 0 && currencyAmount >= itemPrice;
    
    if(success && substractPrice)
    {
        SubstractItemPrice(itemPrice, currencyName);
    }
        
    return success;
}

//////////////////////////////////////////////////////////////////////////////////////////
//
//  Photon Events
//
//////////////////////////////////////////////////////////////////////////////////////////

handlers.RoomCreate = function (args) {
    server.WriteTitleEvent({
        EventName : "room_create"
    });
    return { ResultCode : 0, Message: 'Success' };
};

handlers.RoomCreated = function (args) {
    server.WriteTitleEvent({
        EventName : "room_created"
    });
    return { ResultCode : 0, Message: 'Success' };
};

handlers.RoomJoined = function (args) {
    server.WriteTitleEvent({
        EventName : "room_joined"
    });
    
    return { ResultCode : 0, Message: 'Success' };
};

handlers.RoomLeft = function (args) {
    server.WriteTitleEvent({
        EventName : "room_left"
    });
    return { ResultCode : 0, Message: 'Success' };
};

handlers.RoomClosed = function (args) {
    server.WriteTitleEvent({
        EventName : "room_closed"
    });
    return { ResultCode : 0, Message: 'Success' };
};

handlers.RoomPropertyUpdated = function (args) {
    server.WriteTitleEvent({
        EventName : "room_property_changed"
    });
    return { ResultCode : 0, Message: 'Success' };
};

handlers.RoomEventRaised = function (args) {
    server.WriteTitleEvent({
        EventName : "room_event_raised"
    });
    return { ResultCode : 0, Message: 'Success' };
};
  
//////////////////////////////////////////////////////////////////////////////////////////
//
//  Ads
//
//////////////////////////////////////////////////////////////////////////////////////////  

var AD_WATCH_KEY = "AdWatch";
var AD_STREAK_KEY = "AdStreak";

handlers.StarStreakRequest = function (args) 
{
    UpdateAdWatch(true);
    
    return "Star streak enable";
}

handlers.StarStreakCancel = function (args) 
{
    UpdateAdWatch(false);
    
    return "Star streak cancel";
}

handlers.StarStreakStep = function (args) 
{
    var GetUserReadOnlyDataRequest = 
    {
        "PlayFabId": currentPlayerId,
        "Keys": [ AD_STREAK_KEY ]
    }; 
    
    var GetUserReadOnlyDataResult = server.GetUserReadOnlyData(GetUserReadOnlyDataRequest);
    
    if(GetUserReadOnlyDataResult.Data.hasOwnProperty(AD_STREAK_KEY))
    {
        var adStreakValue = GetUserReadOnlyDataResult.Data[AD_STREAK_KEY].Value;
        
        return parseInt(adStreakValue);
    }
    
    UpdateAdStreak(0);
        
    return 0;
}

handlers.StarStreakResult = function (args) 
{
    var GetUserReadOnlyDataRequest = 
    {
        "PlayFabId": currentPlayerId,
        "Keys": [ AD_STREAK_KEY ]
    }; 
    
    var GetUserReadOnlyDataResult = server.GetUserReadOnlyData(GetUserReadOnlyDataRequest);
    
    if(GetUserReadOnlyDataResult.Data.hasOwnProperty(AD_STREAK_KEY))
    {
        var adStreakValue = GetUserReadOnlyDataResult.Data[AD_STREAK_KEY].Value;
        
        UpdateAdWatch(false);
        
        var adStreak = parseInt(adStreakValue);
        
        adStreak++;
        
        if(adStreak === 6)
        {
            UpdateAdStreak(1);
            AddStarReward(1);
            
            return 1;
        }
        else
        {
            UpdateAdStreak(adStreak);
            AddStarReward(adStreak);
        
            return adStreak;
        }
    }
    else
    {
        UpdateAdStreak(1);
        AddStarReward(1);
        
        UpdateAdWatch(false);
        
        return 1;
    }
}

function AddStarReward(streakValue)
{
    var rewardAmount = 50 + streakValue * 50;
        
    AddCurrency(rewardAmount, VIRTUAL_CURRENCY_CODE);
}

function UpdateAdStreak(value)
{
    var UpdateUserReadOnlyDataRequest = 
    {
        "PlayFabId": currentPlayerId,
        "Data": {}
    };
    
    UpdateUserReadOnlyDataRequest.Data[AD_STREAK_KEY] = value;
    
    server.UpdateUserReadOnlyData(UpdateUserReadOnlyDataRequest);
}

function UpdateAdWatch(state)
{
    var UpdateUserReadOnlyDataRequest = 
    {
        "PlayFabId": currentPlayerId,
        "Data": {}
    };
    
    UpdateUserReadOnlyDataRequest.Data[AD_WATCH_KEY] = state;
    
    server.UpdateUserReadOnlyData(UpdateUserReadOnlyDataRequest);
}
    
//////////////////////////////////////////////////////////////////////////////////////////
//
//  Addressables
//
//////////////////////////////////////////////////////////////////////////////////////////  

var ADDRESSABLES_VERSION_KEY = "AddressablesBuildVersion";

handlers.SetAddressablesVersion = function (args) 
{
    var UpdateUserReadOnlyDataRequest = 
    {
        "PlayFabId": currentPlayerId,
        "Data": {}
    };
    
    UpdateUserReadOnlyDataRequest.Data[ADDRESSABLES_VERSION_KEY] = args.Version;
    
    server.UpdateUserReadOnlyData(UpdateUserReadOnlyDataRequest);
}
