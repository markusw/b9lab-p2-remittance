const Remittance = artifacts.require("./Remittance.sol");
const helper = require("./helpers/truffleTestHelper");
const truffleAssert = require("truffle-assertions");

const { toBN } = web3.utils;

contract("Remittance", accounts => {
    const [owner, sender, receiver, otherAddress] = accounts;
    const password = "password1";
    const amount = 1000;
    const fee = 100;

    describe("Test depositing and withdrawing funds", async () => {
        before("get a new instance, generate puzzle", async () => {
            instance = await Remittance.new(fee, true, {from: owner});
            puzzle = await instance.generatePuzzle(password, receiver); 
            deadline = 1000;
        });        

        it("Should be possible to deposit funds", async () => {
            const txObj = await instance.depositFunds(puzzle, deadline, {from: sender, value: amount});

            // check event
            truffleAssert.eventEmitted(txObj, "LogDepositCreated", {puzzle: puzzle});
            truffleAssert.eventEmitted(txObj, "LogFeePaid", {sender: sender, amount: toBN(fee)});

            // balance of puzzle should be deposited amount
            const puzzleBalance = (await instance.balances(puzzle)).value.toString();
            assert.equal(puzzleBalance, (amount - fee).toString(), "Didn't deposit funds correctly");
        });

        it("Should be possible to withdraw funds", async () => {
            const ethBeforeWithdrawal = toBN(await web3.eth.getBalance(receiver));

            // // deposit first
            // await instance.depositFunds(puzzle, deadline, {from: sender, value: amount});

            // try withdrawal
            const txObj = await instance.withdrawFunds(password, {from: receiver});

            // check event
            truffleAssert.eventEmitted(txObj, "LogWithdrawn", {
                receiver: receiver, 
                puzzle: puzzle, 
                amount: toBN(amount - fee)
            });

            // calculate tx cost
            const gasUsed = toBN(txObj.receipt.gasUsed);
            const gasPrice = toBN((await web3.eth.getTransaction(txObj.tx)).gasPrice)
            const txCost = toBN(gasPrice).mul(gasUsed);
            // expected balance
            const ethExpected = ethBeforeWithdrawal.add(toBN(amount).sub(txCost).sub(toBN(fee)));

            const actualBalance = await web3.eth.getBalance(receiver);

            assert.equal(ethExpected.toString(), actualBalance.toString(), "Didn't withdraw correct amount");
        });
        it("Should not be possible to deposit with already existing puzzle", async () => {
            const amount = 1000;

            try {
                await instance.depositFunds(puzzle, deadline, {from: sender, value: amount});
            }
            catch (err) {
                assert.equal(err.reason, "Puzzle already used, choose different password");
            }
        });
    });

    describe("Test owner fee", async () => {
        it("Should increase owner fee after a deposit", async () => {
            const feeBalance = await instance.ownerBalances.call(owner);

            assert.equal(feeBalance.toString(), fee.toString());
        });

        it("Should be possible for owner to withdraw fee balance", async () => {
            const feeBalance = await instance.ownerBalances.call(owner);
            const txObj = await instance.withdrawFee({from: owner});
            
            truffleAssert.eventEmitted(txObj, "LogFeeWithdrawn", {
                sender: owner, 
                amount: feeBalance
            });
        });
    });

    describe("Test deadline", async () => {
        beforeEach("Get new instance", async () => {
            instance = await Remittance.new(fee, true, {from: owner});
        });

        it("Should be possible to reclaim after deadline ended", async () => {
            // deposit
            await instance.depositFunds(puzzle, deadline, {from: sender, value: amount});

            // time travel
            await helper.advanceTimeAndBlock(deadline + 1);

            // try reclaim
            const txObj = await instance.reclaimFunds(puzzle, {from: sender});
            
            truffleAssert.eventEmitted(txObj, "LogReclaimed", {
                sender: sender, 
                puzzle: puzzle,
                amount: toBN(amount - fee)
            });
        });

        it("Shouldn't be possible to reclaim before end of deadline", async () => {
            // deposit
            await instance.depositFunds(puzzle, deadline, {from: sender, value: amount});

            // try reclaim
            try {
                await instance.reclaimFunds(puzzle, {from: sender});
            }
            catch (err) {
                assert.equal(err.reason, "Deadline didn't pass yet");
            }
        });
    });
})