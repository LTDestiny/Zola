Role & Goal:
Act as an Expert Frontend Developer specializing in React, TypeScript, and Tailwind CSS. Your task is to build the complete UI layout for a modern, real-time messaging application. The UI must be clean, responsive, and closely follow a master-detail 3-column architecture.

Tech Stack:

React (Functional Components, Hooks)

TypeScript (Strict mode, explicit interfaces)

Tailwind CSS (Utility-first styling, modern UI/UX)

Lucide-React or FontAwesome (for icons)

Architecture & Layout Requirements (3 Columns):

Column 1: Main Navigation Sidebar (Width: ~80px, fixed)

A vertical strip containing primary navigation icons.

Tabs required: Messages (Chat), Contacts (Friends/Requests), and Profile (Settings).

Visual feedback for the active tab (e.g., active background color or indicator).

Column 2: Dynamic List Panel (Width: ~320px, border-right)

Content changes based on the active tab from Column 1.

If 'Messages' is active: Render <ChatList />. Needs a sticky search bar at the top, followed by a scrollable list of chat items (Avatar, Name, last message snippet, timestamp, and unread badge).

If 'Contacts' is active: Render <ContactList />. Should have two sections: "Friend Requests" (showing Name, Avatar, and distinct 'Accept' / 'Decline' buttons) and "All Friends" (alphabetical list).

If 'Profile' is active: Render <ProfileMenu />. Shows user's own avatar, name, and basic settings options.

Column 3: Main Viewport (Flex-1, fluid width)

Empty State (<WelcomeScreen />): Displayed when no chat is selected. Centered illustration/icon with a welcoming message (e.g., "Select a chat to start messaging").

Active State (<ActiveChat />): Displayed when a chat is selected.

Header: Contact's name, avatar, online status, and action icons (Call, Video, Info).

Message History: Scrollable area. Differentiate styling for sent messages (right-aligned, primary color bubble) vs. received messages (left-aligned, gray bubble). Include timestamps.

Input Area: Pinned to the bottom. Includes an attachment icon, a text input field, an emoji icon, and a send button.

Strict TypeScript Constraints:
Before writing component code, define and export the following interfaces:

TabType (literal types)

User (id, name, avatar, status)

Message (id, senderId, text, timestamp)

ChatRoom (id, user: User, lastMessage, unreadCount)

FriendRequest (id, user: User, mutualFriends)

Implementation Instructions for AI:

Generate complete, copy-pasteable code.

Use dummy/mock data arrays to populate the Chat List, Messages, and Friend Requests so the UI renders perfectly out of the box.

Manage the overall state (activeTab, selectedChat) in the main parent component <App /> or <ChatLayout />.

Ensure Tailwind classes account for hover states, transitions (e.g., transition-all duration-200), and a clean light-mode aesthetic (slate/indigo/gray palettes).

Output the code logically, separating types, mock data, and components clearly.