# Social Interaction Suite Documentation

The social interaction engine manages all peer-to-peer communication, public comments, polling mechanisms, group conversations, and notification delivery within Tagmate.

---

## 💬 Real-Time Group Chatrooms

Every neighborhood has a dedicated room chat allowing broad neighborhood discussion without requiring a specific post.
* **Backend Channel**: Synced via **Supabase Realtime** websocket subscriptions.
* **Optimistic Updates**: Sending a message appends it to the UI layout immediately, then sends it to Supabase in the background, updating the message metadata on success.
* **Auto Scroll**: Viewport scrolls dynamically to the bottom on new incoming messages.

---

## 📬 Direct Messaging (DM)

Users can initiate private message threads directly from any post coordinate:
* Helps coordinate physical pickups (e.g. for items sold), coordinate missing pet handoffs, or handle neighborhood issues privately.
* Displays a list of active private threads in the DM inbox.

---

## 🌳 Threaded Comments & Mentions
Tagmate supports a standard public discussion layer on each post:
* **Nested Reply Trees**: Supports one-level deep replies (`parent-reply` hierarchy).
* **Likes & Reacts**: Users can react to comments.
* **Mentions**: Mentioning `@username` highlights the username and notifies the mentioned resident.

---

## 📅 Event RSVPs
For posts of kind `event`, residents can register their response:
* Options include `Attending`, `Declining`, or `Interested`.
* Displays a visual RSVP counter detailing total attendee metrics.

---

## 📊 Question Polls
Allows authors to gather community opinions by posting a poll:
* Supports up to **5 options**.
* Integrates live percentage displays that update as votes are cast.
* Singular vote lock-in ensures that each user can only vote once per poll.

---

## 🔔 Notification Center
A local notification dashboard that displays real-time badges and alerts when:
* Someone replies to your post or comment.
* You receive a new Direct Message.
* Someone likes your post.
* A user registers an RSVP to your event.

---

## Social Graph And Public Profiles

Authenticated residents have limited public profiles at `/users/:uid`. They expose a display name, bio, reputation, and public posts—never email or account metadata. Residents can follow people, neighborhoods, and topics; the Feed provides transparent **Latest**, **Nearby**, and chronological **Following** modes.

Blocking is enforced by Supabase row-level policies as well as the UI. It hides the blocked resident's content and prevents future follows, mentions, discovery, and direct messages. Conversation mute is intentionally narrower: it only suppresses unread-message alerts.

---

## Durable Activity And Messaging

The global notification drawer replaces feed-only activity UI. Notifications have explicit actor, target, and read timestamps; opening an item marks it read and deep-links to the post, comment, profile, or DM thread.

DMs persist read timestamps, support inbox search, linked-post context, mute, report, and block actions. The UI deliberately does not claim online presence or typing status.

---

## Verified Local Updates

Actionable updates (`alert`, `traffic`, `weather`, `utility`, `event`, `sale`, `market`, `shopping`, `business`, `health`, and `question`) support one confirmation per non-author resident. Feed, map, neighborhood, and detail views show current status and confirmation count.

Authors (and administrators) can add chronological status entries. Questions use `active`/`closed`; other actionable updates use `active`/`resolved`/`cancelled`. Confirming names are visible only from the post-detail view.
