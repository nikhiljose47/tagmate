# Neighborhood AI Concierge ("Chatmate AI")

The Neighborhood AI Concierge, named **Chatmate AI**, provides localized assistance for neighborhood residents. It acts as an interface that interprets active post data and answers direct, natural language queries about events, sales, safety alerts, and local services in the neighborhood.

---

## ⚙️ Architecture & Data Parsing

### 1. Slide-Over Panel UX
* Built as a sliding glassmorphic overlay panel situated on the right side of the main neighborhood feed.
* Fully responsive and scrollable, featuring state indicators (e.g. typing animations) and action controls.

### 2. Real-Time Neighborhood Context Parsing
Instead of using complex remote language models by default, Chatmate AI parses context dynamically on the frontend:
* It reads the currently loaded neighborhood tags/posts directly from the active view model.
* It parses fields such as coordinates, descriptions, event categories, categories (Alert, Traffic, Sale, Event, Food, etc.), and expiration metrics.
* When a query is made, it builds a local, structured corpus of neighborhood posts to evaluate.

### 3. Synonym Phrase Mapping
To route natural conversation inquiries correctly, the AI utilizes a localized conversational synonym dictionary:
* **Road/Traffic Closures**: Maps phrases like `accident`, `closure`, `road blocked`, `delay` to look up posts with the `Traffic` or `Alert` tag category.
* **Deals & Bargains**: Maps phrases like `sale`, `discount`, `cheap`, `offer` to posts tagged as `Sale` or `Market`.
* **Dining & Food**: Maps phrases like `food`, `eat`, `restaurant`, `cafe` to posts categorized as `Food`.

---

## ⚡ Interactive Map Actions

To tie conversational answers back to the visual interface, response messages from Chatmate AI include interactive action links:
* **Pin on Map**: A button that dynamically triggers a viewport fly-to operation on the main MapLibre map, focusing and highlighting the exact post coordinates.
* **Details**: A deep-link action that opens the full detail thread of the post (e.g., to read comments, view attachments, or RSVP).

---

## 🏷️ Preset Quick Actions
To facilitate quick interactions, preset action chips are available at the top of the interface:
* **Summarize**: Prompts the AI to summarize all current active neighborhood events and alerts.
* **Bargains**: Asks the AI for active deals and items for sale in the local area.
* **Traffic Status**: Asks the AI for recent traffic alerts or road blockages.
