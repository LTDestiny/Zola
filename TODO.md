# Fix Plan Progress Tracker

## 1. Message CSS Alignment
- [ ] `frontend/web/src/pages/components/ChatMessage.tsx` - Remove row padding, ensure edge alignment
- [ ] `frontend/web/src/pages/components/direct/DirectConversationPane.tsx` - Remove container horizontal padding
- [ ] `frontend/web/src/pages/components/group/GroupConversationPane.tsx` - Remove container horizontal padding

## 2. Block State Standardization
- [ ] `frontend/web/src/pages/ChatPage.tsx` - Fix activeDirectFriendshipStatus to distinguish blocked directions
- [ ] `frontend/web/src/pages/ChatPage.tsx` - Ensure all guards use blockedUserIdSet/blockedByPeerUserIdSet
- [ ] `frontend/web/src/pages/ChatPage.tsx` - Fix activeDirectConversationNotice messages

## 3. Realtime Event Handlers
- [ ] `frontend/web/src/pages/ChatPage.tsx` - Add FRIENDSHIP_REQUEST_SENT handler
- [ ] `frontend/web/src/pages/ChatPage.tsx` - Add FRIENDSHIP_REQUEST_DECLINED handler
- [ ] `frontend/web/src/pages/ChatPage.tsx` - Add FRIENDSHIP_REQUEST_CANCELLED handler
- [ ] `frontend/web/src/pages/ChatPage.tsx` - Add FRIENDSHIP_REMOVED handler

## 4. Contacts Deduplication
- [ ] `frontend/web/src/pages/ChatPage.tsx` - Ensure no overlap between friends/sent pending/incoming/blocked

## 5. Profile Modal Guards
- [ ] `frontend/web/src/pages/components/UserProfilePreviewModal.tsx` - Verify canMessage/canAddFriend logic

## Testing
- [ ] TypeScript compilation passes
- [ ] Manual test checklist completed
