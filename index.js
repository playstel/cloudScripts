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

	var GetUserReadOnlyDataRequest = {
        "PlayFabId": currentPlayerId,
        "Keys": [ CHECK_IN_TRACKER ]
    }; 
    
    var GetUserReadOnlyDataResponse = server.GetUserReadOnlyData(GetUserReadOnlyDataRequest);
    
    // need to ensure that our data field exists
    var tracker = {}; // this would be the first login ever (across any title), so we have to make sure our record exists.
        
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

    	return {"currentStreak":tracker[TRACKER_LOGIN_STREAK],"bonusIsReady":false,"bonusName":"Gold Medium","message":"This was your first login! " + Date.now(), 
    	    "firstLoginBonus": true };
    }

    var values = tracker.split(';');
    
    var loginStreak = parseInt(values[0]);
    var nextGrant = parseInt(values[1]);

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

            GrantItems("Gold Medium", "Support");
        
    	    return {"currentStreak":loginStreak,"bonusIsReady":false,"bonusName":"","message":"Your consecutive login streak has been broken. Login tomorrow to get a bonus! " + Date.now(), 
    	    "firstLoginBonus": false };
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
		
		return SetBonus(loginStreak);
	}

    return {"currentStreak":loginStreak,"bonusIsReady":false,"bonusName":"","message":"Bonus is not ready yet! " + Date.now(), 
    	    "firstLoginBonus": false };
};

function SetBonus(Streak) {
 
    var streak = parseInt(Streak);
    
    var bonusName = "Gold Small";
    
    if(streak > 7)
    {
        GrantItems("Gold Medium", "Support");
        return {"currentStreak":streak,"bonusIsReady":true,"bonusName":"Gold Medium","message":"Bonus is ready! " + Date.now(), 
    	    "firstLoginBonus": false };
    }
    else
    {
        GrantItems("Gold Small", "Support");
        return {"currentStreak":streak,"bonusIsReady":true,"bonusName":"Gold Small","message":"Bonus is ready! " + Date.now(), 
    	    "firstLoginBonus": false };
    }
    
    return null;
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
//  Referral Programm
//
//////////////////////////////////////////////////////////////////////////////////////////

var VIRTUAL_CURRENCY_CODE = "GL";
var VIRTUAL_CURRENCY_AMOUNT = 100;
var PLAYER_REFERRAL_KEY = "Referral";
var PLAYER_REFERRAL_REWARD_KEY = "ReferralReward";
var MAXIMUM_REFERRALS = 5;
var REFERRAL_BONUS_BUNDLE = "ReferralPack";
var REFERRER_BONUS_BUNDLE = "ReferrerPack";
var REFERRAL_MARK = "ReferralMark";
var CATALOG_VERSION_REF = "Setup";

// Referral code is PlayFabId of referrer
handlers.RedeemReferral = function(args) {

    try
    {
        // Check Input Correct
        if(args == null || typeof args.referralCode === undefined || args.referralCode === "")
        {
            throw "Failed to redeem. Referral code is undefined or blank";
        }
        
        else if(args.referralCode === currentPlayerId)
        {
            throw "You are not allowed to refer yourself";
        }
        
        // Check Referral Mark
        var GetUserInventoryResult = server.GetUserInventory({ "PlayFabId": currentPlayerId });
        
        for(var index in GetUserInventoryResult.Inventory)
        {
            if(GetUserInventoryResult.Inventory[index].ItemId === REFERRAL_MARK)
            {
                throw "You are only allowed one Referral Mark";
            }
        }


        // Reward for Referrer
        var GetUserReadOnlyDataRequest = 
        {
            "PlayFabId": args.referralCode,
            "Keys": [ PLAYER_REFERRAL_KEY ]
        }; 
        
        var GetUserReadOnlyDataResult = server.GetUserReadOnlyData(GetUserReadOnlyDataRequest);
        
        // Referrals list of Referrer 
        var referralValues = [];
        
        
        // If Player has become the Referrer at the First Time
        if(!GetUserReadOnlyDataResult.Data.hasOwnProperty(PLAYER_REFERRAL_KEY))
        {
            referralValues.push(currentPlayerId);
            ProcessReferrer(args.referralCode, referralValues);
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
                    ProcessReferrer(args.referralCode, referralValues);
                }
                
                else
                {
                    log.info("Your referral has hit the maximum number of referrals (" + MAXIMUM_REFERRALS + ")" );
                }
            }
            
            else
            {
                throw "An error occured when parsing the referrer's player data";
            }
        }
        
        SetReferralFriend(currentPlayerId, args.referralCode, "Confirmed");
        SetReferralFriend(args.referralCode, currentPlayerId, "Confirmed");
        //SetReferralFriend(args.referralCode, currentPlayerId, "Invited");
        
        GrantReferralBonus();
        
        //GrantReferrerBonus(args.referralCode, currentPlayerId);
        
        RecordReferrerBonus(referrerId, args.referralCode);
        
        return null;
    } 
    catch(e) 
    {
        return e;
    }
};

//////////////////////////////////////////////////////////////////////////////////////////

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

function ProcessReferrer(id, referrals)
{
    // Bonus for Referral and his Referrer
    var UpdateUserReadOnlyDataRequest = 
    {
        "PlayFabId": id,
        "Data": {}
    };
    
    UpdateUserReadOnlyDataRequest.Data[PLAYER_REFERRAL_KEY] = JSON.stringify(referrals);
    
    server.UpdateUserReadOnlyData(UpdateUserReadOnlyDataRequest);
}

//////////////////////////////////////////////////////////////////////////////////////////

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

function GrantReferrerBonus(referrerId, referralId)
{
    var GrantItemsToUserRequest = 
    {
        "CatalogVersion" : CATALOG_VERSION_REF,
        "PlayFabId" : referrerId,
        "ItemIds" : [ REFERRER_BONUS_BUNDLE ]
    };

    var GrantItemsToUserResult = server.GrantItemsToUser(GrantItemsToUserRequest);
    
    return GrantItemsToUserResult.ItemGrantResults;
}

function RecordReferrerBonus(referrerId, referralId)
{
    // Reward for Referrer
    var GetUserReadOnlyDataRequest = 
    {
        "PlayFabId": referrerId,
        "Keys": [ PLAYER_REFERRAL_REWARD_KEY ]
    }; 
    
    var GetUserReadOnlyDataResult = server.GetUserReadOnlyData(GetUserReadOnlyDataRequest);

    var referralValues = [];
    
    if(!GetUserReadOnlyDataResult.Data.hasOwnProperty(PLAYER_REFERRAL_REWARD_KEY))
    {
        referralValues.push(referralId);
        AddReferrerReward(referralValues);
    }
    else
    {
        referralValues = JSON.parse(GetUserReadOnlyDataResult.Data[PLAYER_REFERRAL_REWARD_KEY].Value);
            
        if(Array.isArray(referralValues))
        {
            referralValues.push(referrerId);
            AddReferrerReward(referralValues);
        }
        
        else
        {
            throw "An error occured when parsing the referrer's player data";
        }
    }
}

function AddReferrerReward(referralsRecord)
{
    var UpdateUserReadOnlyDataRequest = 
    {
        "PlayFabId": currentPlayerId,
        "Data": {}
    };
    
    UpdateUserReadOnlyDataRequest.Data[PLAYER_REFERRAL_REWARD_KEY] = JSON.stringify(referralsRecord);
    
    server.UpdateUserReadOnlyData(UpdateUserReadOnlyDataRequest);
}

handlers.CheckNewReferrals = function(args) 
{
    var GetUserReadOnlyDataRequest = 
    {
        "PlayFabId": currentPlayerId,
        "Keys": [ PLAYER_REFERRAL_REWARD_KEY ]
    }; 
    
    var GetUserReadOnlyDataResult = server.GetUserReadOnlyData(GetUserReadOnlyDataRequest);

    var referralValues = [];
    
    if(GetUserReadOnlyDataResult.Data.hasOwnProperty(PLAYER_REFERRAL_REWARD_KEY))
    {
        referralValues = JSON.parse(GetUserReadOnlyDataResult.Data[PLAYER_REFERRAL_REWARD_KEY].Value);
        
        return referralValues.length;
        
        if(Array.isArray(referralValues))
        {
            return {"message":"Referrals was found", "referrals" : referralValues, "reward" : referralValues.length * 1000};
        }
        else
        {
            return {"message":"Referral value error"};
        }
    }
    
    return {"message":"No referrals found"};
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
    UpdateUserDataRequest.Data[SKIN_KEY] = SKIN_START_VALUE;
    UpdateUserDataRequest.Data[DISABLE_AD_KEY] = DISABLE_AD_VALUE_DEFAULT;
    
    server.UpdateUserData(UpdateUserDataRequest);
    
    GrantItems(DEFAULT_ITEMS_PACK, DEFAULT_ITEMS_CATALOG);
    
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

handlers.DisableAds = function(args)
{
    var UpdateUserDataRequest = 
    {
        "PlayFabId": currentPlayerId,
        "Data": {},
        "Permission": "Public"
    };
    
    UpdateUserDataRequest.Data[DISABLE_AD_KEY] = DISABLE_AD_VALUE_PURCHASED;
    
    server.UpdateUserData(UpdateUserDataRequest);
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
    var success = PayForItem(args.ItemId, args.CatalogVersion, true);
    
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
    return PayForItem(args.ItemId, args.CatalogVersion, true);
}    
    
function PayForItem(itemId, catalogVersion, substractPrice) 
{
    var GetCatalogItemsResult = server.GetCatalogItems({ CatalogVersion: catalogVersion });
    
    var itemPrice = 0;
    
    for(var catalogItem in GetCatalogItemsResult.Catalog)
    {
        var item = GetCatalogItemsResult.Catalog[catalogItem];
        
        if(item.ItemId == itemId)
        {
            itemPrice = item.VirtualCurrencyPrices["GL"];
        }
    }
    
    var request = { "InfoRequestParameters": { "GetUserVirtualCurrency": true }, "PlayFabId": currentPlayerId };
    var currencyAmount = server.GetPlayerCombinedInfo(request).InfoResultPayload.UserVirtualCurrency["GL"];
    
    var success = itemPrice > 0 && currencyAmount >= itemPrice;
    
    if(success && substractPrice)
    {
        SubstractItemPrice(itemPrice, "GL");
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
    
