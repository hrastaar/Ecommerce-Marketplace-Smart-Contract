pragma solidity >= 0.5.0;

import "./ownable.sol";

contract MarketPlace is Ownable {
  event NewListing(uint listingId);
  event CompletedOrder(address buyerAddress, address sellerAddress, uint orderId);
  event BuyerSuccessfullyPurchased(uint orderId);
  event SuccessfulListingCreated(uint listingId);
  event SuccessfullyModifiedListing(uint listingId);

  enum ListingStatus { ACTIVE, PURCHASED, COMPLETED, DELETED, MODIFIED }
  // Object holding info for Item Listing.
  struct Listing {
    uint listingId;
    string itemName;
    string itemDescription;
    string itemLocation;
    string imageURL;
    uint priceWei;
    address payable sellerAddress;
    uint orderId;

    uint dateCreated;
    uint datePurchased;

    ListingStatus status;
  }

  // Object holding info for listing purchase.
  struct Order {
    uint orderId;
    uint listingId;
    address payable sellerAddress;
    address payable buyerAddress;

    bool buyerTransactionApproval;
    bool sellerTransactionApproval;

    string trackingNumber;
    string trackingProvider;
  }

  // Object holding info about the user (can always be updated)
  struct User {
    string username;
    string name;
    string phoneNumber;
    string email;

    uint positiveReviewCount;
    uint neutralReviewCount;
    uint negativeReviewCount;

    address walletAddress;
    uint dateCreated;
  }

  modifier IsOrderBuyer(uint _orderId) {
    Order memory orderInfo = orderIdToOrder[_orderId];
    require(orderInfo.buyerAddress == msg.sender, "FAILED MODIFIER: Must be buyer address to continue.");
    _;
  }

  modifier IsOrderSeller(uint _orderId) {
    Order memory orderInfo = orderIdToOrder[_orderId];
    require(orderInfo.sellerAddress == msg.sender, "FAILED MODIFIER: Must be seller address to continue.");
    _;
  }

  modifier IsListingSeller(uint _listingId) {
    Listing memory listingInfo = liveListings[_listingId];
    require(listingInfo.sellerAddress == msg.sender, "FAILED MODIFIER: Must be seller address to access.");
    _;
  }

  event Paid(address indexed _from, uint _value);

  function () external payable {
    emit Paid(msg.sender, msg.value);
  }

  /**
  * liveListings: listingId to ListingFactory
  * userToLiveListings: seller address to list of seller listingIds
  * addressToLiveListingCount: seller address to count of listings up.
  * addressToUser: eth address to User object
  */
  mapping(uint256 => Listing) public liveListings;
  mapping(address => uint[]) public userToLiveListings;
  mapping(address => uint) public addressToLiveListingCount;
  mapping(address => User) public addressToUser;

  mapping(uint => Order) private orderIdToOrder;
  mapping(address => uint[]) private addressToPurchases;
  mapping(address => uint[]) private addressToItemsSold;

  mapping(address => uint) public balances;

  constructor() public {

  }

  function _createListing(string memory _itemName,
                          string memory _itemDescription,
                          string memory _itemLocation,
                          string memory _imageURL,
                          uint _priceWei) internal returns (uint) {
      uint newListingId = uint(keccak256(abi.encodePacked(_itemName, _itemDescription, msg.sender, now)));
      Listing memory newListing = Listing(newListingId, _itemName, _itemDescription, _itemLocation, _imageURL, _priceWei, msg.sender, 0, now, 0, ListingStatus.ACTIVE);
      liveListings[newListingId] = newListing;
      userToLiveListings[msg.sender].push(newListingId);
      addressToLiveListingCount[msg.sender]++;
      return newListingId;
  }

  function createListing(string memory _itemName,
                         string memory _itemDescription,
                         string memory _itemLocation,
                         string memory _imageURL,
                         uint _priceWei) public returns (uint) {
      require(addressToLiveListingCount[msg.sender] < 15, "Seller has reached max number of listings.");
      emit SuccessfulListingCreated(_createListing(_itemName, _itemDescription, _itemLocation, _imageURL, _priceWei));
  }

  function _deleteListing(uint256 _listingId) internal {
      delete liveListings[_listingId];
      uint256[] storage userListings = userToLiveListings[msg.sender];

      // Find listingId index in seller's listing array.
      uint idx = 0;
      for (uint i = 0; i < userListings.length; i++) {
          if (userListings[i] == _listingId) {
              idx = i;
              break;
          }
      }
      // replace with the last element in the array, and pop back of array.
      userListings[idx] = userListings[userListings.length-1];
      userListings.pop();

      userToLiveListings[msg.sender] = userListings;
      addressToLiveListingCount[msg.sender]--;
  }

  function deleteListing(uint _listingId) public IsListingSeller(_listingId) {
      _deleteListing(_listingId);
  }

  function modifyListing(uint _listingId,
                         string memory _itemName,
                         string memory _itemDescription,
                         string memory _itemLocation,
                         string memory _imageURL,
                         uint _priceWei) public IsListingSeller(_listingId) payable {
      liveListings[_listingId] =
          Listing(_listingId, _itemName, _itemDescription, _itemLocation, _imageURL, _priceWei, msg.sender, 0, now, 0, ListingStatus.MODIFIED);
      emit SuccessfullyModifiedListing(_listingId);
  }

  function getUsersLiveListings_IDs() public view returns (uint[] memory) {
      return userToLiveListings[msg.sender];
  }

  function getLiveListingDetails(uint256 _listingId) public view returns (string memory,
                                                                          string memory,
                                                                          string memory) {
      Listing memory listing = liveListings[_listingId];
      return (listing.itemName,
              listing.itemDescription,
              listing.itemLocation);
  }

  function buyItem(uint _listingId) public payable {
    Listing memory listing = liveListings[_listingId];

    require(listing.listingId != 0, "Cannot buy listing. ListingID invalid");
    require(msg.value >= listing.priceWei, "Buyer didnt send enough ether.");
    require(balances[msg.sender] + msg.value > balances[msg.sender], "Error adding ether value to balance");

    liveListings[_listingId].status = ListingStatus.PURCHASED;

    uint orderId = uint(keccak256(abi.encodePacked(listing.listingId, msg.sender, listing.sellerAddress, now)));

    Order memory newOrder = Order(orderId, listing.listingId, listing.sellerAddress, msg.sender, false, false, "", "");
    addressToPurchases[msg.sender].push(orderId);
    addressToItemsSold[listing.sellerAddress].push(orderId);
    orderIdToOrder[orderId] = newOrder;

    emit BuyerSuccessfullyPurchased(orderId);
  }

  function getOrderInfo(uint _orderId) public view returns (uint, address, address) {
    Order memory order = orderIdToOrder[_orderId];
    return (order.listingId, order.buyerAddress, order.sellerAddress);
  }

  /**
  * TO-DO List: buyerApprovesTransaction, sellerUploadsTrackingInfo, sellerApprovesTransaction
  */

  function buyerApprovesTransaction(uint _orderId,
                                    bool doesApprove) public IsOrderBuyer(_orderId) {
    Order memory orderInfo = orderIdToOrder[_orderId];
    if (doesApprove) {
      orderInfo.buyerTransactionApproval = true;
      orderIdToOrder[_orderId] = orderInfo;
    }

    if (orderInfo.buyerTransactionApproval && orderInfo.sellerTransactionApproval) {
      unlockFunds(orderInfo.orderId);
      emit CompletedOrder(msg.sender, orderInfo.sellerAddress, orderInfo.orderId);
    }
  }

  function sellerUploadsTrackingInfo(uint _orderId,
                                     string memory _trackingNumber,
                                     string memory _trackingProvider) public IsOrderSeller(_orderId) {
    Order memory orderInfo = orderIdToOrder[_orderId];
    orderInfo.trackingNumber = _trackingNumber;
    orderInfo.trackingProvider = _trackingProvider;
    orderIdToOrder[_orderId] = orderInfo;
  }

  function sellerApprovesTransaction(uint _orderId,
                                     bool doesApprove) public IsOrderSeller(_orderId) returns (string memory)  {
    Order memory orderInfo = orderIdToOrder[_orderId];
    if (doesApprove) {
      orderInfo.sellerTransactionApproval = true;
      orderIdToOrder[_orderId] = orderInfo;
    }

    if (orderInfo.buyerTransactionApproval && orderInfo.sellerTransactionApproval) {
      unlockFunds(orderInfo.orderId);
      emit CompletedOrder(orderInfo.buyerAddress, msg.sender, orderInfo.orderId);
    }
    return "";
  }

  // Send ether tip to contract owner.
  function tipSmartContract() payable public {
    require(balances[msg.sender] + msg.value >= balances[msg.sender], "Couldnt handle payment deposit. User balance overflowed.");
    balances[msg.sender] += msg.value;
  }

  function unlockFunds(uint orderId) private {
    Order memory orderInfo = orderIdToOrder[orderId];
    Listing memory listingInfo = liveListings[orderInfo.listingId];
    require(balances[orderInfo.buyerAddress] - listingInfo.priceWei <= balances[orderInfo.buyerAddress], "Unlock Funds failed. Couldnt remove funds from buyer address.");
    orderInfo.sellerAddress.transfer(listingInfo.priceWei);
    balances[orderInfo.buyerAddress] = balances[orderInfo.buyerAddress] - listingInfo.priceWei;
  }

}
