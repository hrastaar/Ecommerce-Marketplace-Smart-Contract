const truffleAssert = require('truffle-assertions');

const MarketPlace = artifacts.require('./MarketPlace.sol');

contract('Marketplace', (accounts) => {
  before(async () => {
    this.marketplace = await MarketPlace.deployed();
  });

  it('deploys successfully', async () => {
    const address = await this.marketplace.address;
    assert.notEqual(address, 0x0);
    assert.notEqual(address, '');
    assert.notEqual(address, null);
    assert.notEqual(address, undefined);
  });

  it('seller creates listing', async() => {
    const listingsCountBefore = await this.marketplace.addressToLiveListingCount.call(accounts[0]);
    assert.equal(listingsCountBefore, 0);

    // Create listing 1
    const listing1_result = await this.marketplace.createListing("Playstation 5", "Brand New", "Los Angeles, CA", "https://playstation.com/ps5", 1000000, {from: accounts[0]});
    const listing1 = listing1_result.logs[0].args;
    assert.notEqual(listing1.listingId, 0x0);

    // Create listing 2
    const listing2_result = await this.marketplace.createListing("Nintendo Switch", "Used", "New York City, NY", "https://nintendo.com", 200000, {from: accounts[0]});
    const listing2 = listing2_result.logs[0].args;
    assert.notEqual(listing2.listingId, 0x0);
    assert.notEqual(listing1.listingId, listing2.listingId);

    const listingsCountAfter = await this.marketplace.addressToLiveListingCount.call(accounts[0]);
    assert.equal(listingsCountAfter, 2);

    // Ensure that item info was properly saved on mapping liveListings
    const id1 = await this.marketplace.userToLiveListings(accounts[0], 0);
    assert.notEqual(id1.toString(), '');

    const liveListing1 = await this.marketplace.liveListings(id1);
    assert.equal(liveListing1.itemName.toString(), "Playstation 5");
    assert.equal(liveListing1.itemDescription.toString(), "Brand New");
    assert.equal(liveListing1.itemLocation.toString(), "Los Angeles, CA");
    assert.equal(liveListing1.imageURL.toString(), "https://playstation.com/ps5");
    assert.equal(liveListing1.priceWei.toNumber(), 1000000);
    assert.equal(liveListing1.sellerAddress.toString(), accounts[0]);

    const id2 = await this.marketplace.userToLiveListings(accounts[0], 1);
    assert.notEqual(id2.toString(), '');

    const liveListing2 = await this.marketplace.liveListings(id2);
    assert.equal(liveListing2.itemName.toString(), "Nintendo Switch");
    assert.equal(liveListing2.itemDescription.toString(), "Used");
    assert.equal(liveListing2.itemLocation.toString(), "New York City, NY");
    assert.equal(liveListing2.imageURL.toString(), "https://nintendo.com");
    assert.equal(liveListing2.priceWei.toNumber(), 200000);
    assert.equal(liveListing2.sellerAddress.toString(), accounts[0]);
  });

  it('seller modifies listing', async() => {
    // Gather listingId + modify listing information
    const id = await this.marketplace.userToLiveListings(accounts[0], 0);
    const modifyListing = await this.marketplace.modifyListing(id, "Xbox Series X", "Mint Condition", "Miami, FL", "xbox.com", 25000000, {from: accounts[0]});
    assert.equal(id.toString(), modifyListing.logs[0].args.listingId.toString());

    // Ensure that listing modifications were made.
    const liveListing = await this.marketplace.liveListings(id);
    assert.equal(liveListing.itemName.toString(), "Xbox Series X");
    assert.equal(liveListing.itemDescription.toString(), "Mint Condition");
    assert.equal(liveListing.itemLocation.toString(), "Miami, FL");
    assert.equal(liveListing.imageURL.toString(), "xbox.com");
    assert.equal(liveListing.priceWei.toNumber(), 25000000);
    assert.equal(liveListing.sellerAddress.toString(), accounts[0]);

    // Ensure that another account cannot modify a listing.
    await truffleAssert.reverts(this.marketplace.modifyListing(id, "Xbox Series X", "Mint Condition", "Miami, FL", "xbox.com", 1, {from: accounts[1]}));
  });

  it('buyer purchases listing', async() => {
    const id = await this.marketplace.userToLiveListings(accounts[0], 0);
    // Ensure that attempted purchase without enough ether fails.
    await truffleAssert.reverts(this.marketplace.buyItem(id, {from: accounts[1], value: 1}), "Buyer didnt send enough ether.");
    // Ensure that attempted purchase with correct amount of ether works.
    const buyListing = await this.marketplace.buyItem(id, {from: accounts[1], value: 25000000});
    const orderId = buyListing.logs[0].args.orderId.toString();
    assert.notEqual(orderId, id.toString());

    const orderInfo = await this.marketplace.orderIdToOrder.call(orderId);
    assert.equal(orderInfo.listingId.toString(), id);
    assert.equal(orderInfo.sellerAddress.toString(), accounts[0]);
    assert.equal(orderInfo.buyerAddress.toString(), accounts[1]);
    assert.equal(orderInfo.buyerTransactionApproval, false);
    assert.equal(orderInfo.sellerTransactionApproval, false);
  });









});
