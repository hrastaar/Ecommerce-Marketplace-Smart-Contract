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

    // Ensure that the user's balance was updated to have payment.
    const buyerBalance = await this.marketplace.balances.call(accounts[1]);
    assert.equal(buyerBalance.toNumber(), 25000000);

    // Ensure that listing status updated to PURCHASED.
    const updatedListingInfo = await this.marketplace.liveListings(id);
    assert.equal(updatedListingInfo.status.toString(), 3);

    // Gather the details of the order from the orderIdToOrder mapping.
    const orderInfo = await this.marketplace.orderIdToOrder.call(orderId);
    assert.equal(orderInfo.listingId.toString(), id);
    assert.equal(orderInfo.sellerAddress.toString(), accounts[0]);
    assert.equal(orderInfo.buyerAddress.toString(), accounts[1]);
    assert.equal(orderInfo.buyerTransactionApproval, false);
    assert.equal(orderInfo.sellerTransactionApproval, false);
  });

  it('seller approves order, buyer doesnt, seller balance stays same', async() => {
    const initialBuyerBalance = await this.marketplace.balances.call(accounts[1]);

    const listingId = await this.marketplace.userToLiveListings(accounts[0], 0);
    const listing = await this.marketplace.liveListings(listingId);

    const sellerApprovesTransaction = await this.marketplace.sellerApprovesTransaction(listing.orderId, true, {from: accounts[0]});
    const completedOrderEvent = await this.marketplace.buyerApprovesTransaction(listing.orderId, false, {from: accounts[1]});

    const finalBuyerBalance = await this.marketplace.balances.call(accounts[1]);
    // Ether balance shouldn't have changed (decreased) through this process.
    assert.equal(initialBuyerBalance.toNumber(), finalBuyerBalance.toNumber());
  });


  it('seller gets paid from successful order', async() => {
    const initialBuyerBalance = await this.marketplace.balances.call(accounts[1]);

    const listingId = await this.marketplace.userToLiveListings(accounts[0], 0);
    const listing = await this.marketplace.liveListings(listingId);

    const sellerApprovesTransaction = await this.marketplace.sellerApprovesTransaction(listing.orderId, true, {from: accounts[0]});
    const completedOrderEvent = await this.marketplace.buyerApprovesTransaction(listing.orderId, true, {from: accounts[1]});

    // Confirm emitted event data was accurate.
    assert.equal(completedOrderEvent.logs[0].args.buyerAddress.toString(), accounts[1]);
    assert.equal(completedOrderEvent.logs[0].args.sellerAddress.toString(), accounts[0]);
    assert.equal(completedOrderEvent.logs[0].args.orderId.toString(), listing.orderId);

    const finalBuyerBalance = await this.marketplace.balances.call(accounts[1]);
    // Ether should be deducted from the buyer's balance.
    assert.notEqual(initialBuyerBalance.toNumber(), finalBuyerBalance.toNumber());
  });

  it('successful order cancellation', async() => {
    // Buyer makes purchase
    const prevWalletBalance = await web3.eth.getBalance(accounts[2]);
    const listingId = await this.marketplace.userToLiveListings(accounts[0], 1);
    const buyerPurchasesListing = await this.marketplace.buyItem(listingId, {from: accounts[2], value: 200000});
    // Buyer tries cancel order
    const orderId = (await this.marketplace.liveListings(listingId)).orderId;
    await this.marketplace.buyerCancelOrder(orderId, {from: accounts[2]});
    
    // Ether not yet refunded
    const walletBalance = await web3.eth.getBalance(accounts[2]);
    assert.notEqual(walletBalance, prevWalletBalance);
    const prevBuyerBalance = await this.marketplace.balances.call(accounts[2]);
    assert.equal(prevBuyerBalance.toNumber(), 200000);

    // Seller approves cancellation of order
    await this.marketplace.sellerCancelOrder(orderId, {from: accounts[0]});
    // Ether now should be refunded to buyer
    const currBuyerBalance = await this.marketplace.balances.call(accounts[2]);
    assert.equal(currBuyerBalance.toNumber(), 0);
    assert.notEqual(prevBuyerBalance, currBuyerBalance);
  });

  it('tip smart contract', async() => {
    const prevAccountBalance = await this.marketplace.balances.call(accounts[0]);
    const beforeContractBalance = await this.marketplace.getContractBalance();
    assert.equal(prevAccountBalance.toNumber(), 0);

    await this.marketplace.makeDeposit({from: accounts[0], value: 25000000});

    const currAccountBalance = await this.marketplace.balances.call(accounts[0]);
    assert.equal(currAccountBalance.toNumber(), 25000000);

    const afterContractBalance = await this.marketplace.getContractBalance();
    assert.equal(afterContractBalance.logs[0].args.balance.toNumber(), 25000000);
    assert.notEqual(beforeContractBalance.logs[0].args.balance.toNumber(), afterContractBalance.logs[0].args.balance.toNumber());
  });

});
