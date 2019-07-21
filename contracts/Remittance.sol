pragma solidity ^0.5.8;

import "./Stoppable.sol";

contract Remittance is Stoppable {
    mapping (bytes32 => uint) public balances;

    event LogDepositCreated(address indexed sender, bytes32 indexed puzzle, uint amount);
    event LogWithdrawn(address indexed receiver, bytes32 indexed puzzle, uint amount);

    constructor(bool initialRunState) public Stoppable(initialRunState) {}

    function depositFunds(bytes32 puzzle) public payable onlyIfRunning returns(bool success) {
        require(msg.value > 0, "Needs ether");

        balances[puzzle] += msg.value;

        emit LogDepositCreated(msg.sender, puzzle, msg.value);

        return true;
    }

    function withdrawFunds(string memory password) public onlyIfRunning returns(bool success) {
        bytes32 puzzle = keccak256(abi.encodePacked(password, msg.sender));
        uint withdrawAmount = balances[puzzle];
        require(withdrawAmount > 0, "No balance to withdraw or wrong password");

        balances[puzzle] = 0;
        emit LogWithdrawn(msg.sender, puzzle, withdrawAmount);
        msg.sender.transfer(withdrawAmount);

        return true;
    }
}