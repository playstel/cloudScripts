//////////////////////////////////////////////////////////////////////////////////////////
//
//      "Battle Crew" 
//      Playstel Copyright (c) 2021
//
//////////////////////////////////////////////////////////////////////////////////////////
//
//      Purchase/Rent Items
//
//////////////////////////////////////////////////////////////////////////////////////////

handlers.GetItem = function(args) 
{
    GetItemPrice(args.Uses, args.CatalogVers, args.DisplayName, args.Currency);
    
    GetUserCurrency(args.Currency);
    
    if(UserCurrency >= ItemPrice)
    {
        SubstractItemPrice(args.Currency);
        return CheckItemOwning(args.Uses, args.CatalogVers, args.DisplayName);
    }
    else
    {
        return "Insufficient Funds";
    }
}


var ItemPrice;

function GetItemPrice(Uses, Catalog, ItemId, Currency)
{
    var GetCatalogItemsResult = server.GetCatalogItems({ "CatalogVersion": Catalog });
        
    for(var catalogItem in GetCatalogItemsResult.Catalog)
    {
        var item = GetCatalogItemsResult.Catalog[catalogItem];
            
        if(item.ItemId == ItemId)
        {
            var instancePrice = item.VirtualCurrencyPrices[Currency];
            ItemPrice = instancePrice * Uses;
        }
    }
}

var UserCurrency;
function GetUserCurrency(Currency)
{
    var request = { "InfoRequestParameters": { "GetUserVirtualCurrency": true }, "PlayFabId": currentPlayerId };
    UserCurrency = server.GetPlayerCombinedInfo(request).InfoResultPayload.UserVirtualCurrency[Currency];
	return UserCurrency;
}


function SubstractItemPrice(Currency)
{
    server.SubtractUserVirtualCurrency({PlayFabId: currentPlayerId, 
    VirtualCurrency: Currency, Amount: ItemPrice});
}

function CheckItemOwning(Uses, Catalog, DisplayName)
{
    var GetUserInventoryResult = server.GetUserInventory({ "PlayFabId": currentPlayerId });
            
    // Item already exist?
    for(var index in GetUserInventoryResult.Inventory)
    {
        var item = GetUserInventoryResult.Inventory[index];
            
        if(item.DisplayName == DisplayName)
        {
            var result = ModifyItemUses(Uses, item);
            SetOwningStatus(Uses, item, Catalog);
            return result;
        }
    }
    
    // If item doesn't exist      
    return GetNewItemInstance(Uses, Catalog, DisplayName);
}

function ModifyItemUses(Uses, Item)
{
    var ModifyItemUsesRequest = 
    {
        "UsesToAdd" : Uses,
        "PlayFabId" : currentPlayerId,
        "ItemInstanceId" : Item.ItemInstanceId
    };
    
    return server.ModifyItemUses(ModifyItemUsesRequest);
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

var purchaseThreshold = 60;
function SetOwningStatus(Uses, Item, Catalog)
{
    if(Catalog == "Look")
    {
        SetOwnerStatusCustomData("Purchased", Item);
    }
    
    if(Catalog == "Stacks")
    {
        SetOwnerStatusCustomData("Rented", Item);
    }
    
    if(Catalog == "Weapons")
    {
        if(Uses >= purchaseThreshold)
        {
            SetOwnerStatusCustomData("Purchased", Item);
        }
        else
        {
            SetOwnerStatusCustomData("Rented", Item);
        }
        
        var updatedUses = Uses;
            
        if(Item.CustomData != null) 
        {
            var rentTimeString = Item.CustomData['RentTime'];
            var rentTimeInt = parseInt(rentTimeString);
            
            updatedUses = Uses + rentTimeInt;
        }
        
        SetRentTimeCustomData(updatedUses, Item);
    }
}

function SetRentTimeCustomData(Uses, Item)
{
    server.UpdateUserInventoryItemCustomData({ PlayFabId: currentPlayerId, 
    ItemInstanceId: Item.ItemInstanceId, Data: { "RentTime": Uses }});
}

function SetOwnerStatusCustomData(Status, Item)
{
    server.UpdateUserInventoryItemCustomData({ PlayFabId: currentPlayerId, 
    ItemInstanceId: Item.ItemInstanceId, Data: { "Status": Status }});
}

function GetNewItemInstance(Uses, Catalog, DisplayName)
{
    var GrantItemsToUserResult = GrantItems(DisplayName, Catalog);
        
    for(var index in GrantItemsToUserResult.ItemGrantResults)
    {
        var item = GrantItemsToUserResult.ItemGrantResults[index];
            
        if(item.DisplayName === DisplayName)
        {
            var usesWithoutGrantedInstance = Uses - 1;
            
            var result = ModifyItemUses(usesWithoutGrantedInstance, item);
    
            SetOwningStatus(Uses, item, Catalog);
            
            return result;
        }
    }
}

//////////////////////////////////////////////////////////////////////////////////////////
//
//  Grant Start Items
//
//////////////////////////////////////////////////////////////////////////////////////////

var stacksPackName = "Start Stacks Pack";
var lookPackName = "Start Look Pack";
var weaponsPackName = "Start Weapons Pack";

handlers.GrantStartWeapons = function(args) 
{
    GrantItems(weaponsPackName, "Weapons");
    
    var GetUserInventoryResult = server.GetUserInventory({ "PlayFabId": currentPlayerId });
            
    for(var index in GetUserInventoryResult.Inventory)
    {
        var item = GetUserInventoryResult.Inventory[index];
        
        if(item.CatalogVersion == "Weapons") 
        {
            SetStartStatus(item, item.CatalogVersion);
        }
    }
}
handlers.GrantStartStacks = function(args) 
{
    GrantItems(stacksPackName, "Stacks");
    
    var GetUserInventoryResult = server.GetUserInventory({ "PlayFabId": currentPlayerId });
            
    for(var index in GetUserInventoryResult.Inventory)
    {
        var item = GetUserInventoryResult.Inventory[index];
        
        if(item.CatalogVersion == "Stacks") 
        {
            SetStartStatus(item, item.CatalogVersion);
        }
    }
}

handlers.GrantStartLook = function(args) 
{
    GrantItems(lookPackName, "Look");
    
    var GetUserInventoryResult = server.GetUserInventory({ "PlayFabId": currentPlayerId });
            
    for(var index in GetUserInventoryResult.Inventory)
    {
        var item = GetUserInventoryResult.Inventory[index];
        
        if(item.CatalogVersion == "Look") 
        {
            SetStartStatus(item, item.CatalogVersion);
        }
    }
}

function SetStartStatus(Item, Catalog)
{
    if(Catalog == "Look")
    {
        SetOwnerStatusCustomData("Purchased", Item);
    }
    
    if(Catalog == "Stacks")
    {
        SetOwnerStatusCustomData("Rented", Item);
    }
    
    if(Catalog == "Weapons")
    {
        SetOwnerStatusCustomData("Purchased", Item);
        SetRentTimeCustomData(0, Item);
    }
}


//////////////////////////////////////////////////////////////////////////////////////////
//
//  Update Inventory
//
//////////////////////////////////////////////////////////////////////////////////////////

handlers.UpdateInventory = function(args) {

    var GetUserInventoryResult = server.GetUserInventory({ "PlayFabId": currentPlayerId });
            
    for(var index in GetUserInventoryResult.Inventory)
    {
        var item = GetUserInventoryResult.Inventory[index];
            
        if(item.CatalogVersion == "Look")
        {
            continue;
        }
            
        if(item.CatalogVersion == "Stacks")
        {
            SimpleUses(item);
            continue;
        }
            
        if(item.CatalogVersion == "Weapons")
        {
            if(item.CustomData == null) continue;
            
            var status = item.CustomData['Status'];
                
            var rentTime = 0;
                
            if(status == "Rented")
            {
                var rentTimeRaw = RentTime(item);
                rentTime = Math.round(rentTimeRaw);
            }
                
            if(status == "Purchased")
            {
                rentTime = 0;
            }
                
            server.UpdateUserInventoryItemCustomData({ PlayFabId: currentPlayerId, 
            ItemInstanceId: item.ItemInstanceId, Data: { "RentTime": rentTime }});
                    
            continue;
        }
    }
        
    return GetUserInventoryResult.Inventory;
}

function SimpleUses(Item)
{
    if(Item.RemainingUses > 0)
    {
        return Item.RemainingUses;
    }
    else
    {
        return RevokeItem(Item);
    }
}

var secInDay = 86400;
function RentTime(Item)
{
    if(Item.CustomData == null) return 0;
    
    var rentTime = Item.CustomData['RentTime'];
    
    //var rentSec = rentTime * secInDay;
    
    var rentSec = Item.RemainingUses * secInDay;
                        
    var purchaseDate = Date.parse(Item.PurchaseDate) / 1000;
                        
    var now = Date.now() / 1000; 
                    
    var currentExpiration = now - purchaseDate;
                            
    if(currentExpiration > rentSec)
    {
        return RevokeItem(Item);
    }
    else
    {
        var daysRemain = rentSec - currentExpiration;
        var value = daysRemain / secInDay;
                            
        if (value < 1 && value >= 0) 
        {
            return 1;
        }
        if (value > 1)
        {
            return value;
        }
    }
}

function RevokeItem(Item)
{
    server.RevokeInventoryItem({ PlayFabId: currentPlayerId, ItemInstanceId: Item.ItemInstanceId });
    return 0;
}


//////////////////////////////////////////////////////////////////////////////////////////
//
//      REFERRAL PROGRAM
//
//////////////////////////////////////////////////////////////////////////////////////////

var VIRTUAL_CURRENCY_CODE = "DM";
var VIRTUAL_CURRENCY_AMOUNT = 100;
var PLAYER_REFERRAL_KEY = "Referral";
var MAXIMUM_REFERRALS = 12;
var REFERRAL_BONUS_BUNDLE = "ReferralPack";
var REFERRAL_MARK = "ReferralMark";
var CATALOG_VERSION_REF = "Achievements";

// Referral code is PlayFabId of referrer
handlers.RedeemReferral = function(args) {

    try
    {
        // Check Input Correct
        if(args == null || typeof args.referralCode === undefined || args.referralCode === "")
        {
            throw "Failed to redeem. args.referralCode is undefined or blank";
        }
        
        else if(args.referralCode === currentPlayerId)
        {
            throw "You are not allowed to refer yourself.";
        }

        
        // Check Referral Mark
        var GetUserInventoryResult = server.GetUserInventory({ "PlayFabId": currentPlayerId });
        
        for(var index in GetUserInventoryResult.Inventory)
        {
            if(GetUserInventoryResult.Inventory[index].ItemId === REFERRAL_MARK)
            {
                throw "You are only allowed one Referral Mark.";
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
                    log.info("Player:" + args.referralCode + 
                    " has hit the maximum number of referrals (" + MAXIMUM_REFERRALS + ")." );
                }
            }
            
            else
            {
                throw "An error occured when parsing the referrer's player data.";
            }
        }
        
        SetReferralFriend(currentPlayerId, args.referralCode, "Referral");
        SetReferralFriend(args.referralCode, currentPlayerId, "Referrer");
        
        // Bonus for Referral
        return GrantReferralBonus(args.referralCode);
    } 
    catch(e) 
    {
        var retObj = {};
        
        retObj["errorDetails"] = "Error: " + e;
        
        return null;
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
    
    var SetFriendTagRequest = 
    {
            "PlayFabId": userId,
            "FriendPlayFabId": friendId,
            "Tags": [ "Confirmed", refTag ]
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
    
    var UpdateUserReadOnlyDataResult = server.UpdateUserReadOnlyData(UpdateUserReadOnlyDataRequest);

    var AddUserVirtualCurrencyRequest = 
    {
        "PlayFabId" : id,
        "VirtualCurrency": VIRTUAL_CURRENCY_CODE,
        "Amount": VIRTUAL_CURRENCY_AMOUNT
    };
    
    var AddUserVirtualCurrencyResult = server.AddUserVirtualCurrency(AddUserVirtualCurrencyRequest);

    log.info(AddUserVirtualCurrencyRequest.Amount + " " + VIRTUAL_CURRENCY_CODE 
    + " granted to " + id);
    
    return AddReferralUnit(id);
}

//////////////////////////////////////////////////////////////////////////////////////////

function AddReferralUnit(id)
{
    var REFERRALS = 0;

    var playerStats = server.GetPlayerStatistics({ PlayFabId: id }).Statistics;
    
    for (var i = 0; i < playerStats.length; i++)
    {
        if (playerStats[i].StatisticName === "Referrals")
        {
            REFERRALS = playerStats[i].Value;
        }
    }
    
    REFERRALS++;
    
    var request = { PlayFabId: id, Statistics: 
        [{
            StatisticName: "Referrals",
            Value: REFERRALS
        }]
    };
             
    var playerStatResult = server.UpdatePlayerStatistics(request);
    return playerStatResult;
}

//////////////////////////////////////////////////////////////////////////////////////////

function GrantReferralBonus(code)
{
    var GrantItemsToUserRequest = 
    {
        "CatalogVersion" : CATALOG_VERSION_REF,
        "PlayFabId" : currentPlayerId,
        "ItemIds" : [ REFERRAL_MARK, REFERRAL_BONUS_BUNDLE ],
        "Annotation" : "Referred by: " + code
    };

    var GrantItemsToUserResult = server.GrantItemsToUser(GrantItemsToUserRequest);
    
    return GrantItemsToUserResult.ItemGrantResults;
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
            "FriendTitleDisplayName": args.FriendName
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
            "PlayFabId": args.UserId,
            "FriendPlayFabId": args.FriendId
        }; 
        
        return server.RemoveFriend(RemoveFriendRequest);
}


//////////////////////////////////////////////////////////////////////////////////////////
//
//  Characters
//
//////////////////////////////////////////////////////////////////////////////////////////


handlers.CreateCustomCharacter = function(args) {
    
    var GrantCharacterToUserRequest = 
    {
        "CharacterName": args.CharacterName,
        "CharacterType": "Custom",
        "PlayFabId": currentPlayerId,
    }
    
    var GrantCharacterToUserResult = server.GrantCharacterToUser(GrantCharacterToUserRequest);
    
    return GrantCharacterToUserResult.CharacterId;
}

//////////////////////////////////////////////////////////////////////////////////////////

var secretKey = "1AIBIWQD8ZC7MJ3D319ZPK5GSWXQ9ZCM9Z73JP1MBX37NU49RF";
handlers.RemoveCustomCharacter = function(args) {
    
    var DeleteCharacterFromUserRequest = 
    {
        "CharacterId": args.CharacterId,
        "PlayFabId": currentPlayerId,
        "SaveCharacterInventory": true,
    }
    
    return server.DeleteCharacterFromUser(DeleteCharacterFromUserRequest);
}


//////////////////////////////////////////////////////////////////////////////////////////
//
//      STATISTICS
//
//////////////////////////////////////////////////////////////////////////////////////////

var CAPTURES;
var RESOURCE;
var FRAGS;
    
handlers.UpdateUserStatistic = function(args, context) {
    
    GetBattleStats();
    
    switch(args.rewartType)
    {
        case "HeavyVehicle":
        FRAGS++;
        RESOURCE += 1000;
        break;
        
        case "LightVehicle":
        FRAGS++;
        RESOURCE += 800;
        break;
    }
    
    SetBattleStats();
}

function GetBattleStats()
{
    var playerStats = server.GetPlayerStatistics({ PlayFabId: currentPlayerId }).Statistics;
    
    for (var i = 0; i < playerStats.length; i++)
    {
        if (playerStats[i].StatisticName === "Captures")
        {
            CAPTURES = playerStats[i].Value;
        }
        
        if (playerStats[i].StatisticName === "Resource")
        {
            RESOURCE = playerStats[i].Value;
        }
        
        if (playerStats[i].StatisticName === "Frags")
        {
            FRAGS = playerStats[i].Value;
        }
    }
}
    
//////////////////////////////////////////////////////////////////////////////////////////

function SetBattleStats()
{
    MMR = (CAPTURES*RESOURCE*FRAGS)/10000;
    
    var request = { PlayFabId: currentPlayerId, Statistics: 
        [{
            StatisticName: "Captures",
            Value: CAPTURES
        },
        {
            StatisticName: "Resource",
            Value: RESOURCE
        },
        {
            StatisticName: "Frags",
            Value: FRAGS
        }]
    };
             
    var playerStatResult = server.UpdatePlayerStatistics(request);
}

//////////////////////////////////////////////////////////////////////////////////////////
//
//  REWARDS
//
//////////////////////////////////////////////////////////////////////////////////////////

var RandomCatalog;

handlers.GrantItem = function()
{ 
    var Catalogs = [ "Weapons", "Strikes", "Characters", "Armor" ],
    RandomCatalog = Catalogs[Math.floor(Math.random() * Catalogs.length)];
    
    var GrantItemsToUserRequest = 
        {
            "CatalogVersion" : RandomCatalog,
            "PlayFabId" : currentPlayerId,
            "ItemIds" : [ "Drop" ],
            "Annotation" : Cups + " Cups"
        };

    var GrantItemsToUserResult = server.GrantItemsToUser(GrantItemsToUserRequest);
    return GrantItemsToUserResult.ItemGrantResults;
}

    
