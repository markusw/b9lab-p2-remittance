pragma solidity ^0.5.8;

import "./SafeMath.sol";
import "./Stoppable.sol";

contract Remittance is Stoppable {
    using SafeMath for uint;

    uint public fee;

    struct Balance {
        address sender;
        uint deadline;
        uint value;
    }

    mapping (bytes32 => Balance) public balances;
    mapping (address => uint) public ownerBalances;

    event LogDepositCreated(address indexed sender, bytes32 indexed puzzle, uint amount);
    event LogWithdrawn(address indexed receiver, bytes32 indexed puzzle, uint amount);
    event LogReclaimed(address indexed sender, bytes32 indexed puzzle, uint amount);
    event LogFeePaid(address indexed sender, uint amount);
    event LogFeeWithdrawn(address indexed sender, uint amount);

    constructor(uint _fee, bool initialRunState) public Stoppable(initialRunState) {
        fee = _fee;
    }

    function generatePuzzle(string memory password, address receiver) public view returns(bytes32) {
        require(receiver != address(0x0), "Receiving address can't be empty");

        return keccak256(abi.encodePacked(password, receiver, address(this)));
    }

    function depositFunds(bytes32 puzzle, uint _deadline) public payable onlyIfRunning returns(bool success) {
        require(msg.value > 0, "Needs ether");
        require(balances[puzzle].sender == address(0x0), "Puzzle already used, choose different password");

        balances[puzzle] = Balance({
            sender: msg.sender,
            deadline: block.timestamp.add(_deadline),
            value: msg.value.sub(fee)
        });

        address owner = getOwner();
        ownerBalances[owner] = ownerBalances[owner].add(fee);

        emit LogDepositCreated(msg.sender, puzzle, msg.value);
        emit LogFeePaid(msg.sender, fee);

        return true;
    }

    function withdrawFunds(string memory password) public onlyIfRunning returns(bool success) {
        bytes32 puzzle = generatePuzzle(password, msg.sender);
        uint withdrawAmount = balances[puzzle].value;
        require(withdrawAmount > 0, "No balance to withdraw or wrong password");

        delete balances[puzzle].value;
        delete balances[puzzle].deadline;

        emit LogWithdrawn(msg.sender, puzzle, withdrawAmount);
        msg.sender.transfer(withdrawAmount);

        return true;
    }

    function reclaimFunds(bytes32 puzzle) public onlyIfRunning returns(bool success) {
        uint withdrawAmount = balances[puzzle].value;

        require(withdrawAmount > 0, "No funds to withdraw");
        require(balances[puzzle].sender == msg.sender, "Only depositer can reclaim funds");
        require(balances[puzzle].deadline < block.timestamp, "Deadline didn't pass yet");

        delete balances[puzzle].value;
        delete balances[puzzle].deadline;

        emit LogReclaimed(msg.sender, puzzle, withdrawAmount);
        msg.sender.transfer(withdrawAmount);

        return true;
    }

    function withdrawFee() public onlyIfRunning returns(bool success) {
        uint withdrawAmount = ownerBalances[msg.sender];

        require(withdrawAmount > 0, "No balance to withdraw");

        emit LogFeeWithdrawn(msg.sender, withdrawAmount);

        msg.sender.transfer(withdrawAmount);

        return true;
    }
}