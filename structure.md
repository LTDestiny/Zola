\\nZola
├── backend
│   ├── admin-service
│   │   ├── src
│   │   │   └── main
│   │   │       ├── java
│   │   │       │   └── com
│   │   │       │       └── zola
│   │   │       │           └── admin
│   │   │       │               ├── entity
│   │   │       │               │   └── ReportEntity.java
│   │   │       │               ├── repository
│   │   │       │               │   └── ReportRepository.java
│   │   │       │               ├── AdminServiceApplication.java
│   │   │       │               └── HealthController.java
│   │   │       └── resources
│   │   │           ├── db
│   │   │           │   └── migration
│   │   │           │       ├── V1__init_admin_schema.sql
│   │   │           │       └── V2__seed_admin_data.sql
│   │   │           └── application.yml
│   │   ├── Dockerfile
│   │   └── pom.xml
│   ├── ai-service
│   │   ├── src
│   │   │   └── main
│   │   │       ├── java
│   │   │       │   └── com
│   │   │       │       └── zola
│   │   │       │           └── ai
│   │   │       │               ├── entity
│   │   │       │               │   └── AiUsageLogEntity.java
│   │   │       │               ├── repository
│   │   │       │               │   └── AiUsageLogRepository.java
│   │   │       │               ├── AiServiceApplication.java
│   │   │       │               └── HealthController.java
│   │   │       └── resources
│   │   │           ├── db
│   │   │           │   └── migration
│   │   │           │       ├── V1__init_ai_meta_schema.sql
│   │   │           │       └── V2__seed_ai_meta_data.sql
│   │   │           └── application.yml
│   │   ├── Dockerfile
│   │   └── pom.xml
│   ├── api-gateway
│   │   ├── src
│   │   │   └── main
│   │   │       ├── java
│   │   │       │   └── com
│   │   │       │       └── zola
│   │   │       │           └── gateway
│   │   │       │               ├── logging
│   │   │       │               │   └── EndpointLoggingRunner.java
│   │   │       │               ├── proxy
│   │   │       │               │   └── GatewayProxyController.java
│   │   │       │               ├── security
│   │   │       │               │   ├── GatewayJwtFilter.java
│   │   │       │               │   ├── GatewayJwtService.java
│   │   │       │               │   └── GatewaySecurityConfig.java
│   │   │       │               ├── ApiGatewayApplication.java
│   │   │       │               └── HealthController.java
│   │   │       └── resources
│   │   │           └── application.yml
│   │   ├── Dockerfile
│   │   └── pom.xml
│   ├── auth-service
│   │   ├── src
│   │   │   └── main
│   │   │       ├── java
│   │   │       │   └── com
│   │   │       │       └── zola
│   │   │       │           └── auth
│   │   │       │               ├── config
│   │   │       │               │   └── SecurityConfig.java
│   │   │       │               ├── dto
│   │   │       │               │   └── AuthDtos.java
│   │   │       │               ├── entity
│   │   │       │               │   ├── OtpLogEntity.java
│   │   │       │               │   ├── SecurityLogEntity.java
│   │   │       │               │   ├── UserEntity.java
│   │   │       │               │   └── UserSessionEntity.java
│   │   │       │               ├── repository
│   │   │       │               │   ├── OtpLogRepository.java
│   │   │       │               │   ├── SecurityLogRepository.java
│   │   │       │               │   ├── UserRepository.java
│   │   │       │               │   └── UserSessionRepository.java
│   │   │       │               ├── service
│   │   │       │               │   ├── AuthService.java
│   │   │       │               │   ├── EmailSenderService.java
│   │   │       │               │   ├── JwtService.java
│   │   │       │               │   ├── OtpService.java
│   │   │       │               │   ├── SecurityLogService.java
│   │   │       │               │   ├── SessionRedisService.java
│   │   │       │               │   ├── SessionSyncPublisher.java
│   │   │       │               │   └── SmtpEmailSenderService.java
│   │   │       │               ├── web
│   │   │       │               │   └── AuthController.java
│   │   │       │               ├── AuthServiceApplication.java
│   │   │       │               └── HealthController.java
│   │   │       └── resources
│   │   │           ├── db
│   │   │           │   └── migration
│   │   │           │       ├── V1__init_identity_schema.sql
│   │   │           │       └── V2__seed_identity_data.sql
│   │   │           └── application.yml
│   │   ├── Dockerfile
│   │   └── pom.xml
│   ├── call-service
│   │   ├── src
│   │   │   └── main
│   │   │       ├── java
│   │   │       │   └── com
│   │   │       │       └── zola
│   │   │       │           └── call
│   │   │       │               ├── entity
│   │   │       │               │   └── CallLogEntity.java
│   │   │       │               ├── repository
│   │   │       │               │   └── CallLogRepository.java
│   │   │       │               ├── CallServiceApplication.java
│   │   │       │               └── HealthController.java
│   │   │       └── resources
│   │   │           ├── db
│   │   │           │   └── migration
│   │   │           │       ├── V1__init_call_schema.sql
│   │   │           │       └── V2__seed_call_data.sql
│   │   │           └── application.yml
│   │   ├── Dockerfile
│   │   └── pom.xml
│   ├── chat-service
│   │   ├── src
│   │   │   └── main
│   │   │       ├── java
│   │   │       │   └── com
│   │   │       │       └── zola
│   │   │       │           └── chat
│   │   │       │               ├── application
│   │   │       │               │   ├── dto
│   │   │       │               │   │   ├── ConversationSummaryDto.java
│   │   │       │               │   │   ├── MessageDto.java
│   │   │       │               │   │   └── SendMessageCommand.java
│   │   │       │               │   ├── port
│   │   │       │               │   │   ├── in
│   │   │       │               │   │   │   ├── ConversationQueryUseCase.java
│   │   │       │               │   │   │   └── MessageCommandUseCase.java
│   │   │       │               │   │   └── out
│   │   │       │               │   │       ├── ConversationMetadataPort.java
│   │   │       │               │   │       └── MessageStoragePort.java
│   │   │       │               │   └── service
│   │   │       │               │       └── ChatApplicationService.java
│   │   │       │               ├── chatrealtime
│   │   │       │               │   ├── controller
│   │   │       │               │   │   ├── ChatConversationController.java
│   │   │       │               │   │   └── ChatStompController.java
│   │   │       │               │   ├── dto
│   │   │       │               │   │   ├── CallSignalEvent.java
│   │   │       │               │   │   ├── ChatDeleteForMeRequest.java
│   │   │       │               │   │   ├── ChatEditRequest.java
│   │   │       │               │   │   ├── ChatEventResponse.java
│   │   │       │               │   │   ├── ChatForwardRequest.java
│   │   │       │               │   │   ├── ChatReactionRequest.java
│   │   │       │               │   │   ├── ChatReadReceiptRequest.java
│   │   │       │               │   │   ├── ChatRecallRequest.java
│   │   │       │               │   │   ├── ChatSendRequest.java
│   │   │       │               │   │   ├── ChatTypingRequest.java
│   │   │       │               │   │   ├── ConversationListItemResponse.java
│   │   │       │               │   │   ├── ConversationResponse.java
│   │   │       │               │   │   ├── CreateDirectConversationRequest.java
│   │   │       │               │   │   ├── CreateGroupConversationRequest.java
│   │   │       │               │   │   ├── GroupAdminRequest.java
│   │   │       │               │   │   ├── GroupMemberRequest.java
│   │   │       │               │   │   ├── MessageItemResponse.java
│   │   │       │               │   │   ├── MessagePayload.java
│   │   │       │               │   │   ├── MessageReactionPayload.java
│   │   │       │               │   │   ├── MessagesPageResponse.java
│   │   │       │               │   │   └── UserPresenceResponse.java
│   │   │       │               │   └── service
│   │   │       │               │       └── ChatRealtimeService.java
│   │   │       │               ├── config
│   │   │       │               │   └── SecurityConfig.java
│   │   │       │               ├── document
│   │   │       │               │   ├── ConversationDocument.java
│   │   │       │               │   ├── MessageDocument.java
│   │   │       │               │   └── PinnedMessageItem.java
│   │   │       │               ├── domain
│   │   │       │               │   └── model
│   │   │       │               │       ├── ChatMessage.java
│   │   │       │               │       ├── ConversationMetadata.java
│   │   │       │               │       └── ConversationType.java
│   │   │       │               ├── exception
│   │   │       │               │   ├── ForbiddenOperationException.java
│   │   │       │               │   └── ResourceNotFoundException.java
│   │   │       │               ├── infrastructure
│   │   │       │               │   ├── cache
│   │   │       │               │   │   └── RedisOnlineUserChecker.java
│   │   │       │               │   ├── logging
│   │   │       │               │   │   └── EndpointLoggingRunner.java
│   │   │       │               │   └── persistence
│   │   │       │               │       ├── mongo
│   │   │       │               │       │   ├── MessageDocument.java
│   │   │       │               │       │   └── RealtimeMessageRepository.java
│   │   │       │               │       └── postgres
│   │   │       │               │           ├── ConversationEntity.java
│   │   │       │               │           ├── ConversationJpaRepository.java
│   │   │       │               │           ├── MessageHiddenEntity.java
│   │   │       │               │           ├── MessageHiddenJpaRepository.java
│   │   │       │               │           ├── package-info.java
│   │   │       │               │           ├── PostgresConversationRepository.java
│   │   │       │               │           └── PostgresMessageHiddenRepository.java
│   │   │       │               ├── presence
│   │   │       │               │   ├── PresenceController.java
│   │   │       │               │   ├── PresenceEventPublisher.java
│   │   │       │               │   └── PresenceManager.java
│   │   │       │               ├── presentation
│   │   │       │               │   ├── rest
│   │   │       │               │   │   └── package-info.java
│   │   │       │               │   └── websocket
│   │   │       │               │       └── package-info.java
│   │   │       │               ├── repository
│   │   │       │               │   ├── ConversationRepository.java
│   │   │       │               │   └── MessageRepository.java
│   │   │       │               ├── socket
│   │   │       │               │   ├── ChatRealtimeController.java
│   │   │       │               │   ├── DeviceSyncController.java
│   │   │       │               │   ├── SocketAuthChannelInterceptor.java
│   │   │       │               │   ├── SocketJwtService.java
│   │   │       │               │   ├── SyncEventMessage.java
│   │   │       │               │   ├── WebSocketConfig.java
│   │   │       │               │   └── WebSocketEventListener.java
│   │   │       │               ├── web
│   │   │       │               │   ├── ChatGlobalExceptionHandler.java
│   │   │       │               │   └── ChatQueryController.java
│   │   │       │               ├── ChatServiceApplication.java
│   │   │       │               └── HealthController.java
│   │   │       └── resources
│   │   │           ├── db
│   │   │           │   └── migration
│   │   │           │       ├── V1__init_chat_conversation.sql
│   │   │           │       ├── V2__create_message_hidden_table.sql
│   │   │           │       ├── V3__add_unread_tracking_to_conversation.sql
│   │   │           │       └── V4__add_conversation_type.sql
│   │   │           └── application.yml
│   │   ├── Dockerfile
│   │   └── pom.xml
│   ├── common
│   │   ├── src
│   │   │   └── main
│   │   │       └── java
│   │   │           └── com
│   │   │               └── zola
│   │   │                   └── common
│   │   │                       ├── events
│   │   │                       │   ├── call
│   │   │                       │   │   └── CallSignalEvent.java
│   │   │                       │   ├── chat
│   │   │                       │   │   ├── ChatMessageRecalledEvent.java
│   │   │                       │   │   └── ChatMessageSentEvent.java
│   │   │                       │   ├── notification
│   │   │                       │   │   └── NotificationCreatedEvent.java
│   │   │                       │   └── Topics.java
│   │   │                       ├── response
│   │   │                       │   └── ApiResponse.java
│   │   │                       └── storage
│   │   │                           └── ObjectStorageProperties.java
│   │   └── pom.xml
│   ├── file-service
│   │   ├── src
│   │   │   └── main
│   │   │       ├── java
│   │   │       │   └── com
│   │   │       │       └── zola
│   │   │       │           └── file
│   │   │       │               ├── config
│   │   │       │               │   ├── FileSecurityConfig.java
│   │   │       │               │   └── S3Config.java
│   │   │       │               ├── entity
│   │   │       │               │   └── FileAuditLogEntity.java
│   │   │       │               ├── media
│   │   │       │               │   ├── MediaController.java
│   │   │       │               │   └── MediaUploadService.java
│   │   │       │               ├── repository
│   │   │       │               │   └── FileAuditLogRepository.java
│   │   │       │               ├── FileServiceApplication.java
│   │   │       │               └── HealthController.java
│   │   │       └── resources
│   │   │           ├── db
│   │   │           │   └── migration
│   │   │           │       ├── V1__init_file_schema.sql
│   │   │           │       └── V2__seed_file_data.sql
│   │   │           └── application.yml
│   │   ├── Dockerfile
│   │   └── pom.xml
│   ├── notification-service
│   │   ├── src
│   │   │   └── main
│   │   │       ├── java
│   │   │       │   └── com
│   │   │       │       └── zola
│   │   │       │           └── notification
│   │   │       │               ├── entity
│   │   │       │               │   └── NotificationEntity.java
│   │   │       │               ├── repository
│   │   │       │               │   └── NotificationRepository.java
│   │   │       │               ├── HealthController.java
│   │   │       │               └── NotificationServiceApplication.java
│   │   │       └── resources
│   │   │           ├── db
│   │   │           │   └── migration
│   │   │           │       ├── V1__init_notification_schema.sql
│   │   │           │       └── V2__seed_notification_data.sql
│   │   │           └── application.yml
│   │   ├── Dockerfile
│   │   └── pom.xml
│   ├── sql
│   │   └── init.sql
│   ├── user-service
│   │   ├── src
│   │   │   └── main
│   │   │       ├── java
│   │   │       │   └── com
│   │   │       │       └── zola
│   │   │       │           └── user
│   │   │       │               ├── config
│   │   │       │               │   └── SecurityConfig.java
│   │   │       │               ├── entity
│   │   │       │               │   └── FriendshipEntity.java
│   │   │       │               ├── repository
│   │   │       │               │   └── FriendshipRepository.java
│   │   │       │               ├── service
│   │   │       │               │   └── FriendEventPublisher.java
│   │   │       │               ├── web
│   │   │       │               │   └── FriendshipController.java
│   │   │       │               ├── HealthController.java
│   │   │       │               └── UserServiceApplication.java
│   │   │       └── resources
│   │   │           ├── db
│   │   │           │   └── migration
│   │   │           │       ├── V1__init_user_schema.sql
│   │   │           │       ├── V2__seed_user_data.sql
│   │   │           │       └── V3__add_friendship_pending_read_tracking.sql
│   │   │           └── application.yml
│   │   ├── Dockerfile
│   │   └── pom.xml
│   ├── ARCHITECTURE_BLUEPRINT.md
│   └── pom.xml
├── db
│   ├── file.sql
│   ├── full_seed.sql
│   ├── identity.sql
│   └── user.sql
├── frontend
│   ├── mobile
│   │   ├── .expo
│   │   │   ├── devices.json
│   │   │   └── README.md
│   │   ├── src
│   │   │   ├── modules
│   │   │   │   ├── auth
│   │   │   │   │   ├── screens
│   │   │   │   │   │   ├── ForgotPasswordScreen.tsx
│   │   │   │   │   │   ├── LoginScreen.tsx
│   │   │   │   │   │   ├── RegisterScreen.tsx
│   │   │   │   │   │   └── VerifyRegisterOtpScreen.tsx
│   │   │   │   │   ├── authApi.ts
│   │   │   │   │   └── authStore.ts
│   │   │   │   ├── chat
│   │   │   │   │   ├── api
│   │   │   │   │   │   ├── chatApi.ts
│   │   │   │   │   │   ├── httpClient.ts
│   │   │   │   │   │   └── mediaApi.ts
│   │   │   │   │   ├── call
│   │   │   │   │   │   └── CallManager.ts
│   │   │   │   │   ├── components
│   │   │   │   │   │   ├── AddGroupMemberModal.tsx
│   │   │   │   │   │   ├── ChatItem.tsx
│   │   │   │   │   │   ├── InAppCallOverlay.tsx
│   │   │   │   │   │   ├── MessageBubble.tsx
│   │   │   │   │   │   ├── MessageInput.tsx
│   │   │   │   │   │   ├── PresenceBadge.tsx
│   │   │   │   │   │   ├── TypingIndicator.tsx
│   │   │   │   │   │   └── UnreadBadge.tsx
│   │   │   │   │   ├── hooks
│   │   │   │   │   │   ├── useMessages.ts
│   │   │   │   │   │   ├── usePresence.ts
│   │   │   │   │   │   ├── useSocket.ts
│   │   │   │   │   │   ├── useTyping.ts
│   │   │   │   │   │   ├── useUnread.ts
│   │   │   │   │   │   └── useUserProfiles.ts
│   │   │   │   │   ├── screens
│   │   │   │   │   │   ├── ChatDetailScreen.tsx
│   │   │   │   │   │   ├── ChatListScreen.tsx
│   │   │   │   │   │   ├── FriendRequestsScreen.tsx
│   │   │   │   │   │   └── GroupSettingsScreen.tsx
│   │   │   │   │   ├── socket
│   │   │   │   │   │   ├── ChatSocketClient.old.ts
│   │   │   │   │   │   ├── ChatSocketClient.ts
│   │   │   │   │   │   ├── reconnectManager.ts
│   │   │   │   │   │   └── socketService.ts
│   │   │   │   │   ├── store
│   │   │   │   │   │   ├── chatStore.ts
│   │   │   │   │   │   ├── friendRequestStore.ts
│   │   │   │   │   │   ├── presenceStore.ts
│   │   │   │   │   │   └── socketStore.ts
│   │   │   │   │   └── utils
│   │   │   │   │       ├── conversationUtils.ts
│   │   │   │   │       ├── format.ts
│   │   │   │   │       └── timeFormatter.ts
│   │   │   │   └── profile
│   │   │   │       └── screens
│   │   │   │           └── ProfileScreen.tsx
│   │   │   ├── navigation
│   │   │   │   └── AppNavigator.tsx
│   │   │   └── shared
│   │   │       ├── storage
│   │   │       │   └── authToken.ts
│   │   │       ├── theme
│   │   │       │   └── colors.ts
│   │   │       ├── types
│   │   │       │   ├── api.ts
│   │   │       │   └── navigation.ts
│   │   │       └── env.ts
│   │   ├── app.json
│   │   ├── App.tsx
│   │   ├── babel.config.js
│   │   ├── metro.config.js
│   │   ├── package-lock.json
│   │   ├── package.json
│   │   ├── README.md
│   │   ├── rule-mobile.md
│   │   └── tsconfig.json
│   ├── shared
│   │   └── env.ts
│   ├── web
│   │   ├── src
│   │   │   ├── api
│   │   │   │   ├── authApi.ts
│   │   │   │   ├── chatApi.ts
│   │   │   │   ├── chatRealtime.ts
│   │   │   │   ├── httpClient.ts
│   │   │   │   └── mediaApi.ts
│   │   │   ├── auth
│   │   │   │   ├── RequireAuth.tsx
│   │   │   │   └── token.ts
│   │   │   ├── components
│   │   │   │   └── PresenceBadge.tsx
│   │   │   ├── hooks
│   │   │   │   ├── __tests__
│   │   │   │   │   └── usePresence.test.ts
│   │   │   │   ├── usePresence.ts
│   │   │   │   └── useTyping.ts
│   │   │   ├── i18n
│   │   │   │   └── language.tsx
│   │   │   ├── pages
│   │   │   │   ├── call
│   │   │   │   │   └── CallManager.ts
│   │   │   │   ├── components
│   │   │   │   │   ├── AddFriendModal.tsx
│   │   │   │   │   ├── ChatHeader.tsx
│   │   │   │   │   ├── ChatList.tsx
│   │   │   │   │   ├── ChatMessage.tsx
│   │   │   │   │   ├── ChatMessage.types.ts
│   │   │   │   │   ├── ConversationList.tsx
│   │   │   │   │   ├── CreateGroupModal.jsx
│   │   │   │   │   ├── ForwardMessageModal.tsx
│   │   │   │   │   ├── GroupChat.jsx
│   │   │   │   │   ├── InAppCallOverlay.tsx
│   │   │   │   │   ├── MessageActions.tsx
│   │   │   │   │   ├── MessageBubble.tsx
│   │   │   │   │   ├── MessageRenderer.tsx
│   │   │   │   │   ├── MiniNav.tsx
│   │   │   │   │   └── Sidebar.tsx
│   │   │   │   ├── utils
│   │   │   │   │   └── mediaUrl.ts
│   │   │   │   ├── chat.tsx
│   │   │   │   ├── ChatPage.tsx
│   │   │   │   ├── ForgotPasswordPage.tsx
│   │   │   │   ├── HomePage.tsx
│   │   │   │   ├── LoginPage.tsx
│   │   │   │   ├── PolicyPage.tsx
│   │   │   │   └── RegisterPage.tsx
│   │   │   ├── shared
│   │   │   │   └── env.ts
│   │   │   ├── stores
│   │   │   │   ├── authStore.ts
│   │   │   │   └── chatStore.ts
│   │   │   ├── utils
│   │   │   │   ├── __tests__
│   │   │   │   │   └── timeFormatter.test.ts
│   │   │   │   └── timeFormatter.ts
│   │   │   ├── App.tsx
│   │   │   ├── main.tsx
│   │   │   ├── styles.css
│   │   │   └── vite-env.d.ts
│   │   ├── Dockerfile
│   │   ├── Dockerfile.dev
│   │   ├── Dockerfile.prod
│   │   ├── index.html
│   │   ├── package-lock.json
│   │   ├── package.json
│   │   ├── postcss.config.js
│   │   ├── tsconfig.json
│   │   ├── tsconfig.tsbuildinfo
│   │   └── vite.config.ts
│   └── package-lock.json
├── infrastructure
│   ├── bootstrap
│   │   ├── init-local-postgres.ps1
│   │   ├── init-local-postgres.sql
│   │   ├── mongo-seed.js
│   │   ├── postgres-bootstrap.sh
│   │   └── seed-local-auth-users.sql
│   ├── coturn
│   │   └── turnserver.conf
│   ├── k8s
│   │   └── README.md
│   ├── terraform
│   │   └── README.md
│   ├── docker-compose.dev.yml
│   ├── docker-compose.yml
│   ├── package-lock.json
│   └── package.json
├── .env
├── .gitignore
├── Context.md
├── MEDIA_UPLOAD_FEATURE_BLUEPRINT.md
├── PRESENCE_FEATURE.md
├── README.md
├── rule-frontend.md
└── rule.md
\\n