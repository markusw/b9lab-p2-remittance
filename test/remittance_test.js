const Remittance = artifacts.require("./Remittance.sol");
const truffleAssert = require("truffle-assertions");

const { toBN } = web3.utils;

contract("Remittance", accounts => {
    const [owner, sender, receiver, otherAddress] = accounts;
    const password = "password1";

    beforeEach("Get new Instance before each test", async () => {
        instance = await Remittance.new({from: owner});
        puzzle = web3.utils.soliditySha3(password, receiver);
    });

    describe("Test depositing and withdrawing funds", async () => {
        it("Should be possible to deposit funds", async () => {
            const amount = 100;

            const txObj = await instance.depositFunds(puzzle, {from: sender, value: amount});

            // check event
            truffleAssert.eventEmitted(txObj, "LogDepositCreated", {puzzle: puzzle});

            // balance of puzzle should be deposited amount
            const puzzleBalance = (await instance.balances(puzzle)).toString();
            assert.equal(puzzleBalance, amount.toString(), "Didn't deposit funds correctly");
        });

        it("Should be possible to withdraw funds", async () => {
            const amount = 100;
            const ethBeforeWithdrawal = toBN(await web3.eth.getBalance(receiver));

            // deposit first
            await instance.depositFunds(puzzle, {from: sender, value: amount});

            // try withdrawal
            const txObj = await instance.withdrawFunds(password, {from: receiver});

            // check event
            truffleAssert.eventEmitted(txObj, "LogWithdrawn", {
                receiver: receiver, 
                puzzle: puzzle, 
                amount: toBN(amount)
            });

            // calculate tx cost
            const gasUsed = toBN(txObj.receipt.gasUsed);
            const gasPrice = toBN((await web3.eth.getTransaction(txObj.tx)).gasPrice)
            const txCost = toBN(gasPrice).mul(gasUsed);
            // expected balance
            const ethExpected = ethBeforeWithdrawal.add(toBN(amount).sub(txCost));

            const actualBalance = await web3.eth.getBalance(receiver);

            assert.equal(ethExpected.toString(), actualBalance.toString(), "Didn't withdraw correct amount");
        });
    });
})