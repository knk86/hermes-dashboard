# Hermes Dashboard

A comprehensive dashboard for managing and monitoring Hermes agents, organizations, conversations, and system resources.

## Features

- Organization management
- Agent configuration and monitoring
- Conversation tracking and history
- Message logging and analysis
- Resource usage monitoring
- System settings management

## Tech Stack

- **Backend**: Python/FastAPI
- **Database**: SQLite
- **Frontend**: (TBD)

## Installation

1. Clone the repository
2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # Linux/Mac
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Database Setup

Initialize the database by running the schema script:

```bash
sqlite3 hermes.db < server/schema.sql
```

Or use the built-in database initialization in the application.

## Usage

Start the development server:

```bash
python -m uvicorn main:app --reload
```

## Project Structure

```
hermes-dashboard/
├── README.md
├── requirements.txt
├── .gitignore
├── server/
│   └── schema.sql
├── app/
│   └── (application code)
└── data/
    └── (database files)
```

## License

MIT
