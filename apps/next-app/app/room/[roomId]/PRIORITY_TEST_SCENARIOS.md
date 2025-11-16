# Priority Test Scenarios - Critical Missing Tests

Based on analysis of the existing test suite, these are the most critical test scenarios that are currently missing and should be implemented to ensure robustness and stability.

## 🔴 Critical Priority (Security & Stability)

### 1. Error Handling - getUserMedia Failures
**Why Critical**: getUserMedia can fail for many reasons (permissions, device unavailable, etc.). The code has error handling but it's not tested.

**Test Cases Needed**:
```typescript
// Permission denied
it("handles camera permission denied gracefully", async () => {
  getUserMediaMock.mockRejectedValueOnce(new DOMException("Permission denied", "NotAllowedError"));
  // Verify state doesn't break, error is logged, user sees appropriate message
});

it("handles microphone permission denied gracefully", async () => {
  // Similar to above
});

// Device not found
it("handles no camera device available", async () => {
  getUserMediaMock.mockRejectedValueOnce(new DOMException("No device", "NotFoundError"));
});

// Device in use
it("handles device already in use", async () => {
  getUserMediaMock.mockRejectedValueOnce(new DOMException("Device busy", "NotReadableError"));
});
```

### 2. Security - Message Validation
**Why Critical**: Malicious or malformed messages could crash the app or cause security issues.

**Test Cases Needed**:
```typescript
it("ignores malformed signal messages", async () => {
  // Send message with missing required fields
  // Send message with wrong types
  // Send message with null/undefined values
});

it("ignores messages from self", async () => {
  // Verify self-messages are properly filtered
});

it("handles malicious SDP content", async () => {
  // Test with potentially malicious SDP strings
});
```

### 3. Connection State - Channel Errors
**Why Critical**: Network issues are common. The code handles channel status but it's not tested.

**Test Cases Needed**:
```typescript
it("handles channel subscription timeout", async () => {
  activeChannel.triggerStatus("TIMED_OUT");
  // Verify proper error state and recovery
});

it("handles channel error", async () => {
  activeChannel.triggerStatus("CHANNEL_ERROR");
});

it("handles channel closed unexpectedly", async () => {
  activeChannel.triggerStatus("CLOSED");
});
```

### 4. Race Conditions - Concurrent Operations
**Why Critical**: Real-world usage involves rapid user interactions that can cause race conditions.

**Test Cases Needed**:
```typescript
it("handles rapid camera toggles without breaking state", async () => {
  // Rapidly toggle camera multiple times
  // Verify state is consistent
});

it("handles toggle during call start", async () => {
  // Start call and immediately toggle camera
  // Verify both operations complete correctly
});

it("handles multiple simultaneous offers", async () => {
  // Receive offer while already processing another offer
});
```

### 5. Screen Share Error Handling
**Why Critical**: Screen sharing has many failure modes that aren't tested.

**Test Cases Needed**:
```typescript
it("handles screen share permission denied", async () => {
  getDisplayMediaMock.mockRejectedValueOnce(new DOMException("Permission denied", "NotAllowedError"));
});

it("handles screen share unsupported", async () => {
  // Mock getDisplayMedia as undefined
});

it("handles screen share track ended by user", async () => {
  // Simulate user stopping screen share via browser UI
  // Verify cleanup happens correctly
});
```

---

## 🟡 High Priority (Common Failure Modes)

### 6. RTCPeerConnection Errors
**Why Important**: WebRTC operations can fail in various ways.

**Test Cases Needed**:
```typescript
it("handles createOffer failure", async () => {
  // Mock createOffer to reject
});

it("handles setRemoteDescription failure", async () => {
  // Mock setRemoteDescription to reject
});

it("handles addIceCandidate failure", async () => {
  // Mock addIceCandidate to reject
});
```

### 7. Media Track Lifecycle
**Why Important**: Tracks can end unexpectedly (hardware disconnect, etc.).

**Test Cases Needed**:
```typescript
it("handles camera track ended unexpectedly", async () => {
  // Simulate track.readyState = "ended"
  // Verify state updates correctly
});

it("handles microphone track ended unexpectedly", async () => {
  // Similar to above
});

it("handles track mute/unmute events", async () => {
  // Simulate track.muted changes
  // Verify remote state updates
});
```

### 8. Hang Up & Cleanup
**Why Important**: Proper cleanup prevents resource leaks and state issues.

**Test Cases Needed**:
```typescript
it("properly cleans up on hang up", async () => {
  // Start call, then hang up
  // Verify all tracks stopped, connections closed, state reset
});

it("handles hang up during active call", async () => {
  // Hang up while call is active
  // Verify cleanup happens correctly
});

it("handles component unmount during call", async () => {
  // Unmount component during active call
  // Verify cleanup in useEffect return
});
```

### 9. Decline Incoming Call
**Why Important**: Currently not tested at all.

**Test Cases Needed**:
```typescript
it("declines incoming call and sends call-declined event", async () => {
  // Receive offer, decline it
  // Verify call-declined event sent, state reset
});

it("handles decline after accepting", async () => {
  // Edge case: decline after already accepting
});
```

### 10. Room Capacity (Third Participant)
**Why Important**: Room capacity logic exists but isn't tested.

**Test Cases Needed**:
```typescript
it("rejects third participant with room-full event", async () => {
  // Simulate two participants already in room
  // Third participant joins
  // Verify room-full event sent, third participant removed
});
```

---

## 🟢 Medium Priority (Edge Cases & Polish)

### 11. ICE Candidate Handling
**Why Useful**: ICE candidates can arrive out of order or fail.

**Test Cases Needed**:
```typescript
it("queues ICE candidates before remote description", async () => {
  // Send candidates before remote description set
  // Verify they're queued and flushed after
});

it("handles malformed ICE candidates", async () => {
  // Send invalid candidate format
});
```

### 12. Renegotiation Edge Cases
**Why Useful**: Renegotiation can fail or happen at wrong times.

**Test Cases Needed**:
```typescript
it("handles renegotiation failure", async () => {
  // Mock renegotiation to fail
  // Verify error handling
});

it("prevents renegotiation during answer wait", async () => {
  // Attempt renegotiation while awaiting answer
});
```

### 13. State Synchronization
**Why Useful**: State can get out of sync between peers.

**Test Cases Needed**:
```typescript
it("syncs media state after reconnect", async () => {
  // Reconnect and verify media state is broadcast
});

it("handles stale media state updates", async () => {
  // Receive delayed media-state event
});
```

### 14. Screen Share + Media Interactions
**Why Useful**: Complex interactions between screen share and camera.

**Test Cases Needed**:
```typescript
it("handles screen share start during camera toggle", async () => {
  // Start screen share while toggling camera
});

it("handles remote screen share track ended", async () => {
  // Remote track ends unexpectedly
  // Verify cleanup
});
```

### 15. Call Duration & Timer
**Why Useful**: Timer logic should be tested.

**Test Cases Needed**:
```typescript
it("formats call duration correctly", async () => {
  // Test MM:SS format
  // Test hours if applicable
});

it("continues timer after reconnect", async () => {
  // Reconnect and verify timer continues
});
```

---

## Implementation Recommendations

### Mock Extensions Needed

1. **Error Injection in Mocks**:
```typescript
class MockRTCPeerConnection {
  static shouldFailCreateOffer = false;
  static shouldFailSetRemoteDescription = false;
  
  async createOffer() {
    if (MockRTCPeerConnection.shouldFailCreateOffer) {
      throw new Error("createOffer failed");
    }
    // ... existing code
  }
}
```

2. **Track State Simulation**:
```typescript
class MockMediaStreamTrack {
  readyState: "live" | "ended" = "live";
  
  simulateEnd() {
    this.readyState = "ended";
    this.emit("ended");
  }
  
  simulateMute() {
    this.muted = true;
    this.emit("mute");
  }
}
```

3. **Channel Error Simulation**:
```typescript
class MockRealtimeChannel {
  triggerStatus(status: string) {
    this.statusCallback?.(status);
  }
  
  simulateSendFailure() {
    // Mock send to reject
  }
}
```

### Test Structure Recommendations

1. **Group Related Tests**:
```typescript
describe("Error Handling", () => {
  describe("getUserMedia Errors", () => {
    // All getUserMedia error tests
  });
  
  describe("RTCPeerConnection Errors", () => {
    // All WebRTC error tests
  });
});
```

2. **Use Helper Functions**:
```typescript
const setupActiveCall = async () => {
  const { hook, channel } = await setupJoinedRoom();
  // ... setup call
  return { hook, channel };
};
```

3. **Test State Transitions**:
```typescript
it("transitions through all call states correctly", async () => {
  // Verify state at each step
  expect(hook.result.current.isCalling).toBe(false);
  await startCall();
  expect(hook.result.current.isCalling).toBe(true);
  // etc.
});
```

---

## Quick Wins (Easy to Implement)

These tests can be added quickly with minimal mock changes:

1. ✅ Decline incoming call
2. ✅ Channel error/timeout/closed status
3. ✅ Screen share permission denied
4. ✅ Screen share unsupported
5. ✅ Hang up cleanup verification
6. ✅ Call duration formatting
7. ✅ Room capacity (third participant)

---

## Testing Checklist

Before considering the test suite complete, verify:

- [ ] All error paths are tested
- [ ] All state transitions are tested
- [ ] All cleanup paths are tested
- [ ] Race conditions are tested
- [ ] Security scenarios are tested
- [ ] Network failure scenarios are tested
- [ ] Browser API failures are tested
- [ ] Edge cases are tested
- [ ] Concurrent operations are tested

---

**Next Steps**: Start with Critical Priority tests, then move to High Priority. Use the existing test structure as a template and extend mocks as needed.

