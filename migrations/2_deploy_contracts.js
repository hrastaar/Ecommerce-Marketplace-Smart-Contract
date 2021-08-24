const ListingFactory = artifacts.require("./MarketPlace.sol");

module.exports = function(deployer) {
  deployer.deploy(ListingFactory);
};
