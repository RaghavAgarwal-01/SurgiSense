# 🏥 SurgiSense: AI-Powered Clinical Intelligence Platform

![Status](https://img.shields.io/badge/Status-Prototype-blue) ![AI](https://img.shields.io/badge/AI-Groq%20%7C%20Sarvam-orange) ![Stack](https://img.shields.io/badge/Stack-FastAPI%20%7C%20React-green)

**SurgiSense** is a next-generation clinical dashboard designed to reduce administrative burnout and improve patient safety. It digitizes patient records, transcribes multilingual doctor notes, and analyzes surgical wounds using high-speed Generative AI.

Uniquely, SurgiSense implements a **Deterministic Safety Layer**—a hardcoded verification engine that cross-references AI outputs against clinical protocols to prevent hallucinations in critical care data.

---

## 🚀 Key Features

### 1. 📄 Smart Document Digitization (Groq LPU)

* **The Problem:** Doctors spend 40% of their time manually entering data from discharge summaries.
* **The Solution:** Upload PDFs or images of medical records. SurgiSense extracts structured JSON data (Surgery Type, Medications, Dates) in milliseconds.
* **Powered by:** `Llama-3.3-70b-Versatile` running on Groq LPU.

### 2. 🎙️ SurgiVoice: Multilingual Dictation

* **The Problem:** Clinical notes are often a mix of English and local languages (e.g., Hindi/Hinglish), which standard models fail to transcribe.
* **The Solution:** A dedicated voice agent that accurately transcribes mixed-language post-op rounds notes.
* **Powered by:** `Sarvam AI` (Specialized Indic Speech Model).

### 3. 👁️ SurgiVision: Wound Analysis

* **The Problem:** Patients struggle to identify early signs of Surgical Site Infections (SSI) at home.
* **The Solution:** Upload a photo of the surgical site. The AI analyzes it for redness, dehiscence (wound opening), swelling, or pus.
* **Powered by:** `Llava-v1.5-7b` (Vision AI).

### 4. 🛡️ The Safety Engine (The Guardrail)

* **Innovation:** We do not blindly trust the AI.
* **Mechanism:** A custom Python rule engine (`safety_engine.py`) scans the AI's extracted data.
* **Example:** If the AI detects **"Coronary Bypass"** and the medication list contains **"Aspirin"**, the engine automatically triggers a **"Bleeding Risk Alert"** for the doctor to review.

---

## 🛠️ Technology Stack

| Component | Technology | Use Case |
| :--- | :--- | :--- |
| **Frontend** | React.js + Tailwind CSS | Responsive Clinical Dashboard |
| **Backend** | Python (FastAPI) | High-performance Async API |
| **LLM Engine** | Groq API | Ultra-low latency inference |
| **Vision Model** | Llava v1.5 7b | Surgical site image analysis |
| **Speech Model** | Sarvam AI | Hinglish/English Voice-to-Text |
| **PDF Tools** | PyMuPDF (Fitz) | Raw text extraction from files |

---

## ⚡ Installation & Setup

Follow these steps to run SurgiSense locally.

### Prerequisites

* Python 3.10+
* Node.js & npm
* Git

### 1. Clone the Repository

```bash
git clone [https://github.com/RaghavAgarwal-01/SurgiSense.git](https://github.com/RaghavAgarwal-01/SurgiSense.git)
cd SurgiSense