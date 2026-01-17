// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MessageBoard {
    event MessagePosted(address sender, string message);

    function postMessage(string calldata message) external {
        emit MessagePosted(msg.sender, message);
    }
}