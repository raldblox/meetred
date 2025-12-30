# How To Troubleshoot Connectivity

- Refresh to rotate relay reservations; you should see “waiting for peers” complete during boot.
- If you can’t see anyone, check browser permissions for microphone/camera (WebRTC) and allow websockets.
- Use the peer list: green sync icons mean history requests are in-flight; if no peers show, you’re not connected.
- Try toggling networks/VPNs; some corporate networks block WebRTC/WS.
- For logs, open DevTools and enable verbose `ui*`/`libp2p*` logging.
