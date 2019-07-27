const Remittance = artifacts.require("./Remittance.sol");

module.exports = function(deployer) {
    deployer.deploy(Remittance, 100, true);
}