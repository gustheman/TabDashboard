// background.js - Minimal setup as logic is moved to popup and dashboard
chrome.runtime.onInstalled.addListener(() => {
    console.log("Tab Dashboard installed.");
});

chrome.commands.onCommand.addListener((command) => {
    if (command === 'open-dashboard') {
        chrome.tabs.create({
            url: 'dashboard.html'
        });
    }
});