# Comprehensive Test Scenarios for Room.tsx P2P Video Calling

This document outlines all possible test scenarios to ensure rigidity, robustness, and stability of the peer-to-peer video calling implementation. Tests should be unbiased and cover edge cases, security vulnerabilities, and failure modes.

## Table of Contents
1. [Security & Authorization](#security--authorization)
2. [Connection & Disconnection](#connection--disconnection)
3. [Reconnection & Recovery](#reconnection--recovery)
4. [Media Device Management](#media-device-management)
5. [Screen Sharing](#screen-sharing)
6. [WebRTC Signaling](#webrtc-signaling)
7. [State Synchronization](#state-synchronization)
8. [Error Handling & Edge Cases](#error-handling--edge-cases)
9. [Race Conditions](#race-conditions)
10. [Network Conditions](#network-conditions)
11. [Browser API Failures](#browser-api-failures)
12. [Multiple Participants](#multiple-participants)
13. [UI/UX Edge Cases](#uiux-edge-cases)

---

## Security & Authorization

### 1. Message Validation & Injection
- [ ] **Malformed Signal Messages**: Send invalid/malformed signal messages (missing fields, wrong types, null values)
- [ ] **Malformed Room Events**: Send invalid room events with missing required fields
- [ ] **Message Spoofing**: Attempt to send messages with spoofed sender IDs
- [ ] **Self-Message Handling**: Verify messages from self are properly ignored
- [ ] **XSS in Room IDs**: Test with room IDs containing special characters, scripts, or encoded payloads
- [ ] **SDP Injection**: Attempt to inject malicious SDP content
- [ ] **ICE Candidate Injection**: Test with malformed or malicious ICE candidates

### 2. Permission & Access Control
- [ ] **Camera Permission Denied**: Handle getUserMedia rejection for camera
- [ ] **Microphone Permission Denied**: Handle getUserMedia rejection for microphone
- [ ] **Permission Revoked Mid-Call**: Simulate permission revocation during active call
- [ ] **Partial Permission Grant**: Camera allowed but mic denied (or vice versa)
- [ ] **Permission Timeout**: Handle permission prompt timeout
- [ ] **No Media Devices Available**: System has no camera/microphone

### 3. Room Access Control
- [ ] **Room Capacity Enforcement**: Verify third participant is rejected (room-full event)
- [ ] **Room ID Validation**: Test with empty, null, or extremely long room IDs
- [ ] **Channel Subscription Failures**: Handle channel subscription errors
- [ ] **Unauthorized Channel Access**: Attempt to access channels without proper subscription

---

## Connection & Disconnection

### 4. Initial Connection
- [ ] **Channel Subscription Timeout**: Handle TIMED_OUT status
- [ ] **Channel Error**: Handle CHANNEL_ERROR status
- [ ] **Channel Closed Unexpectedly**: Handle CLOSED status during connection
- [ ] **Multiple Join Attempts**: Rapid successive join attempts
- [ ] **Join While Already Joined**: Attempt to join when already in room
- [ ] **Join Without Media Devices**: Join room without requesting media

### 5. Normal Disconnection
- [ ] **User-Initiated Hang Up**: Normal call termination
- [ ] **Page Unload During Call**: beforeunload event during active call
- [ ] **Component Unmount During Call**: Cleanup on unmount
- [ ] **Channel Unsubscribe**: Proper cleanup on channel unsubscribe
- [ ] **Peer Connection Close**: Verify all tracks are stopped

### 6. Unexpected Disconnection
- [ ] **Network Drop During Call**: Sudden network loss
- [ ] **Peer Connection Failure**: RTCPeerConnection fails to establish
- [ ] **ICE Connection Failure**: No ICE candidates found
- [ ] **Signaling Server Disconnect**: Channel disconnects mid-call
- [ ] **Browser Tab Backgrounded**: Tab goes to background during call
- [ ] **Browser Tab Closed**: Tab closed without cleanup

---

## Reconnection & Recovery

### 7. Peer Reconnection
- [ ] **Peer Disconnects and Rejoins**: Already tested, but verify edge cases
- [ ] **Host Disconnects and Rejoins**: Host role reassignment
- [ ] **Guest Disconnects and Rejoins**: Guest reconnection
- [ ] **Multiple Disconnect/Reconnect Cycles**: Rapid reconnection attempts
- [ ] **Reconnect During Screen Share**: Peer reconnects while screen sharing
- [ ] **Reconnect During Media Toggle**: Reconnection during camera/mic toggle

### 8. Call Resume
- [ ] **Resume Call After Peer Rejoin**: Verify resumeCall() works correctly
- [ ] **Resume Call Without Peer**: Attempt resume when peer not present
- [ ] **Resume Call After Media Change**: Resume with different media state
- [ ] **Multiple Resume Attempts**: Rapid resume calls
- [ ] **Resume Call State Consistency**: Verify all state is properly restored

### 9. State Recovery
- [ ] **Recover Media State After Reconnect**: Camera/mic state preserved
- [ ] **Recover Screen Share State**: Screen share state after reconnect
- [ ] **Recover Call Duration**: Call timer continues correctly
- [ ] **Recover Participant List**: Participant tracking after reconnect

---

## Media Device Management

### 10. Camera Toggle
- [ ] **Toggle Camera Before Call**: Already tested
- [ ] **Toggle Camera During Call**: Already tested
- [ ] **Toggle Camera During Screen Share**: Camera toggle while screen sharing
- [ ] **Rapid Camera Toggles**: Multiple rapid toggles
- [ ] **Camera Toggle Failure**: getUserMedia fails during toggle
- [ ] **Camera Hardware Disconnect**: Camera unplugged during call
- [ ] **Camera Permission Revoked**: Permission revoked during toggle
- [ ] **Multiple Camera Devices**: Switch between multiple cameras
- [ ] **Camera Track Ended**: Track ends unexpectedly (hardware failure)

### 11. Microphone Toggle
- [ ] **Toggle Microphone Before Call**: Already tested
- [ ] **Toggle Microphone During Call**: Already tested
- [ ] **Rapid Microphone Toggles**: Multiple rapid toggles
- [ ] **Microphone Toggle Failure**: getUserMedia fails during toggle
- [ ] **Microphone Hardware Disconnect**: Mic unplugged during call
- [ ] **Microphone Permission Revoked**: Permission revoked during toggle
- [ ] **Multiple Microphone Devices**: Switch between multiple mics
- [ ] **Microphone Track Ended**: Track ends unexpectedly

### 12. Simultaneous Media Toggles
- [ ] **Toggle Camera and Mic Simultaneously**: Both at once
- [ ] **Toggle Camera While Mic Toggling**: Overlapping operations
- [ ] **Toggle Media During Screen Share Start**: Media toggle during screen share
- [ ] **Toggle Media During Call Start**: Media toggle during call initiation
- [ ] **Toggle Media During Answer**: Media toggle while answering call

### 13. Media State Synchronization
- [ ] **Remote Media State Update**: Receive media-state event
- [ ] **Stale Media State**: Handle delayed media-state events
- [ ] **Conflicting Media State**: Conflicting state updates
- [ ] **Media State After Reconnect**: State sync after reconnection

---

## Screen Sharing

### 14. Screen Share Basics
- [ ] **Start Screen Share Before Call**: Screen share without active call
- [ ] **Start Screen Share During Call**: Already partially tested
- [ ] **Stop Screen Share**: Normal stop
- [ ] **Screen Share Permission Denied**: getDisplayMedia rejection
- [ ] **Screen Share Unsupported**: Browser doesn't support getDisplayMedia
- [ ] **Screen Share Cancelled**: User cancels permission prompt

### 15. Screen Share Edge Cases
- [ ] **Screen Share Track Ended**: User stops sharing via browser UI
- [ ] **Screen Share During Camera Toggle**: Screen share + camera interaction
- [ ] **Screen Share During Call Start**: Start screen share while starting call
- [ ] **Screen Share During Answer**: Start screen share while answering
- [ ] **Multiple Screen Share Attempts**: Rapid start/stop cycles
- [ ] **Screen Share After Hang Up**: Attempt screen share after call ends

### 16. Remote Screen Share
- [ ] **Remote Starts Screen Share**: Receive screen-share-state event
- [ ] **Remote Stops Screen Share**: Remote stops sharing
- [ ] **Remote Screen Share Track Ended**: Remote track ends unexpectedly
- [ ] **Screen Share During Reconnect**: Screen share state during reconnect
- [ ] **Both Peers Screen Share**: Simultaneous screen sharing (if supported)

### 17. Screen Share + Media Interaction
- [ ] **Camera Toggle During Screen Share**: Already tested - keep screen share
- [ ] **Screen Share Replaces Camera**: Verify camera track not removed
- [ ] **Screen Share + Camera Simultaneously**: Both active at once
- [ ] **Stop Screen Share Restores Camera**: Camera resumes after screen share

---

## WebRTC Signaling

### 18. Offer/Answer Flow
- [ ] **Multiple Simultaneous Offers**: Receive offer while already processing offer
- [ ] **Offer After Answer**: Receive offer after answer sent
- [ ] **Answer After Hang Up**: Receive answer after call ended
- [ ] **Stale Offers**: Handle delayed/out-of-order offers
- [ ] **Offer Without Remote Description**: Offer when no remote description set
- [ ] **Answer Without Local Description**: Answer when no local description set

### 19. ICE Candidates
- [ ] **ICE Candidates Before Remote Description**: Queue candidates properly
- [ ] **ICE Candidates After Connection**: Handle candidates after connection established
- [ ] **Multiple ICE Candidates**: Rapid candidate delivery
- [ ] **Malformed ICE Candidates**: Invalid candidate format
- [ ] **ICE Candidate Failure**: Candidate addition fails
- [ ] **No ICE Candidates**: No candidates generated (network issue)

### 20. Renegotiation
- [ ] **Renegotiation During Stable State**: Media change triggers renegotiation
- [ ] **Renegotiation During Answer Wait**: Renegotiation while awaiting answer
- [ ] **Multiple Renegotiations**: Rapid successive renegotiations
- [ ] **Renegotiation Failure**: Renegotiation offer/answer fails
- [ ] **Renegotiation Race Condition**: Renegotiation during other operations

### 21. Signaling State Management
- [ ] **Signaling State Transitions**: All state transitions (stable, have-local-offer, etc.)
- [ ] **Invalid State Operations**: Operations in wrong signaling state
- [ ] **State Recovery After Error**: Recover from invalid state
- [ ] **Closed Connection Operations**: Operations on closed connection

---

## State Synchronization

### 22. Participant State
- [ ] **Host Role Assignment**: First participant becomes host
- [ ] **Host Reassignment**: Host leaves, new host assigned
- [ ] **Participant List Consistency**: List matches actual participants
- [ ] **Duplicate Participant IDs**: Same ID appears twice (shouldn't happen, but test)
- [ ] **Participant State After Reconnect**: State preserved after reconnect

### 23. Call State
- [ ] **Call State Transitions**: All state transitions (idle → calling → in-call → ended)
- [ ] **State Consistency**: UI state matches internal state
- [ ] **State After Error**: State recovery after errors
- [ ] **Concurrent State Changes**: Multiple state changes simultaneously

### 24. Media State
- [ ] **Local Media State Sync**: Local state matches actual track state
- [ ] **Remote Media State Sync**: Remote state matches received tracks
- [ ] **State Broadcast Timing**: Media state broadcast timing
- [ ] **State After Track Ended**: State update when track ends

---

## Error Handling & Edge Cases

### 25. getUserMedia Errors
- [ ] **OverconstrainedError**: Requested constraints not available
- [ ] **NotAllowedError**: Permission denied
- [ ] **NotFoundError**: No media device found
- [ ] **NotReadableError**: Device in use by another application
- [ ] **AbortError**: User/system aborted request
- [ ] **TypeError**: Invalid constraints
- [ ] **SecurityError**: Insecure context (HTTP vs HTTPS)

### 26. getDisplayMedia Errors
- [ ] **NotAllowedError**: Screen share permission denied
- [ ] **AbortError**: User cancelled screen share
- [ ] **NotReadableError**: Screen share not available
- [ ] **OverconstrainedError**: Display constraints not met

### 27. RTCPeerConnection Errors
- [ ] **createOffer Failure**: Offer creation fails
- [ ] **createAnswer Failure**: Answer creation fails
- [ ] **setLocalDescription Failure**: Setting local description fails
- [ ] **setRemoteDescription Failure**: Setting remote description fails
- [ ] **addIceCandidate Failure**: ICE candidate addition fails
- [ ] **addTrack Failure**: Track addition fails
- [ ] **removeTrack Failure**: Track removal fails
- [ ] **replaceTrack Failure**: Track replacement fails

### 28. Channel Errors
- [ ] **Channel Send Failure**: Message send fails
- [ ] **Channel Subscribe Failure**: Subscription fails
- [ ] **Channel Broadcast Failure**: Broadcast fails
- [ ] **Channel Reconnection**: Channel reconnects automatically

### 29. Edge Cases
- [ ] **Empty Room ID**: Empty string room ID
- [ ] **Very Long Room ID**: Extremely long room ID
- [ ] **Special Characters in Room ID**: URL-encoded characters
- [ ] **Null/Undefined Values**: Handle null/undefined gracefully
- [ ] **Missing Video Elements**: Video refs not available
- [ ] **Video Element Errors**: Video element errors (load, play, etc.)

---

## Race Conditions

### 30. Concurrent Operations
- [ ] **Start Call + Toggle Media**: Call start during media toggle
- [ ] **Answer Call + Toggle Media**: Answer during media toggle
- [ ] **Hang Up + Toggle Media**: Hang up during media toggle
- [ ] **Screen Share + Toggle Media**: Screen share during media toggle
- [ ] **Reconnect + Toggle Media**: Reconnect during media toggle
- [ ] **Multiple Toggles Simultaneously**: All toggles at once

### 31. Signaling Race Conditions
- [ ] **Offer + Answer Simultaneously**: Both peers send offer
- [ ] **Renegotiation + Answer**: Renegotiation during answer wait
- [ ] **Hang Up + Answer**: Hang up while answer in flight
- [ ] **Reconnect + Answer**: Reconnect while answer pending

### 32. State Race Conditions
- [ ] **State Update + Operation**: State update during operation
- [ ] **Multiple State Updates**: Rapid state updates
- [ ] **State Update + Cleanup**: State update during cleanup

---

## Network Conditions

### 33. Network Issues
- [ ] **Slow Network**: High latency connections
- [ ] **Intermittent Connectivity**: Connection drops and recovers
- [ ] **Packet Loss**: Simulated packet loss
- [ ] **Bandwidth Constraints**: Limited bandwidth
- [ ] **NAT/Firewall Issues**: Complex NAT traversal
- [ ] **ICE Connection Timeout**: No connection established

### 34. Connection Quality
- [ ] **Connection State Changes**: iceConnectionState changes
- [ ] **Connection State Failed**: Connection fails
- [ ] **Connection State Disconnected**: Temporary disconnection
- [ ] **Connection State Closed**: Connection closed
- [ ] **Connection State Recovery**: Recovery from failed state

---

## Browser API Failures

### 35. MediaStream API
- [ ] **getUserMedia Not Available**: API not supported
- [ ] **getDisplayMedia Not Available**: API not supported
- [ ] **MediaStream Constructor Fails**: Stream creation fails
- [ ] **Track Methods Fail**: addTrack, removeTrack failures

### 36. RTCPeerConnection API
- [ ] **RTCPeerConnection Not Available**: WebRTC not supported
- [ ] **ICE Servers Unavailable**: STUN/TURN servers down
- [ ] **Connection Limit Reached**: Too many connections
- [ ] **Browser Resource Exhaustion**: Out of memory/resources

### 37. DOM/Video API
- [ ] **Video Element Not Available**: Ref not set
- [ ] **Video Play Fails**: play() promise rejects
- [ ] **Video Load Fails**: Video loading errors
- [ ] **srcObject Assignment Fails**: Assignment errors

---

## Multiple Participants

### 38. Room Capacity
- [ ] **Third Participant Rejected**: Room full handling
- [ ] **Room Full Event**: Proper event sent
- [ ] **Room Full State**: State updated correctly
- [ ] **Room Full Recovery**: Can rejoin after participant leaves

### 39. Participant Management
- [ ] **Multiple Joins**: Two participants join correctly
- [ ] **Participant Leaves**: Proper cleanup
- [ ] **Participant Rejoins**: Rejoin handling
- [ ] **Host Leaves**: Host reassignment

---

## UI/UX Edge Cases

### 40. Call Duration
- [ ] **Call Duration Timer**: Timer increments correctly
- [ ] **Call Duration After Reconnect**: Timer continues
- [ ] **Call Duration Format**: Proper MM:SS format
- [ ] **Long Call Duration**: Hours/minutes formatting

### 41. Status Messages
- [ ] **Status Updates**: All status messages displayed
- [ ] **Status After Errors**: Error status messages
- [ ] **Status Consistency**: Status matches state

### 42. Fullscreen
- [ ] **Fullscreen Toggle**: Enter/exit fullscreen
- [ ] **Fullscreen During Call**: Fullscreen during active call
- [ ] **Fullscreen + Screen Share**: Fullscreen with screen share
- [ ] **Escape Key**: Exit fullscreen with Escape
- [ ] **Fullscreen API Unavailable**: Handle unsupported browsers

### 43. Ringtone
- [ ] **Ringtone Plays**: Audio plays on incoming call
- [ ] **Ringtone Stops**: Audio stops after answer/decline
- [ ] **Ringtone Error**: Audio load/play errors
- [ ] **Autoplay Blocked**: Browser blocks autoplay

### 44. Room Link
- [ ] **Room Link Generation**: Link generated correctly
- [ ] **Room Link Copy**: Clipboard copy works
- [ ] **Room Link Unavailable**: Handle missing link
- [ ] **QR Code Generation**: QR code displays correctly

---

## Test Implementation Priority

### High Priority (Critical Path)
1. Security & Authorization (1-3)
2. Connection & Disconnection (4-6)
3. Media Device Management (10-12)
4. Error Handling - getUserMedia (25)
5. Race Conditions - Concurrent Operations (30)

### Medium Priority (Common Scenarios)
1. Reconnection & Recovery (7-9)
2. Screen Sharing (14-17)
3. WebRTC Signaling (18-21)
4. Error Handling - RTCPeerConnection (27)
5. Network Conditions (33-34)

### Low Priority (Edge Cases)
1. State Synchronization (22-24)
2. Browser API Failures (35-37)
3. Multiple Participants (38-39)
4. UI/UX Edge Cases (40-44)

---

## Notes for Test Implementation

1. **Mock Strategy**: Extend existing mocks to support error injection and state simulation
2. **Async Handling**: Use proper async/await and waitFor for all async operations
3. **State Verification**: Verify both internal state and UI state
4. **Cleanup**: Ensure proper cleanup between tests
5. **Isolation**: Each test should be independent and not rely on previous test state
6. **Error Scenarios**: Test both error handling and recovery
7. **Race Conditions**: Use delays and timing to simulate race conditions
8. **Network Simulation**: Mock network conditions (latency, packet loss, etc.)

---

## Security Checklist

- [ ] Input validation on all user inputs
- [ ] Message validation on all received messages
- [ ] Proper error messages (no sensitive data leakage)
- [ ] XSS prevention in room IDs and user data
- [ ] CSRF protection (if applicable)
- [ ] Rate limiting on signaling messages
- [ ] Proper cleanup of sensitive data (streams, connections)
- [ ] Secure WebRTC configuration (ICE servers, etc.)

---

This document should be updated as new scenarios are discovered or implemented.

