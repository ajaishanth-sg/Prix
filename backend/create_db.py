import os
import sys
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

def bootstrap_database():
    db_name = "prix"
    db_user = os.environ.get("DB_USER", "postgres")
    db_password = os.environ.get("DB_PASSWORD", "Admin@123")
    db_host = os.environ.get("DB_HOST", "localhost")
    db_port = os.environ.get("DB_PORT", "5432")

    print(f"Connecting to PostgreSQL server at {db_host}:{db_port} as user '{db_user}'...")
    
    try:
        # Connect to default 'postgres' database to check and create 'prix'
        conn = psycopg2.connect(
            dbname="postgres",
            user=db_user,
            password=db_password,
            host=db_host,
            port=db_port
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        
        # Check if database exists
        cursor.execute("SELECT 1 FROM pg_catalog.pg_database WHERE datname = %s;", (db_name,))
        exists = cursor.fetchone()
        
        if not exists:
            print(f"Database '{db_name}' does not exist. Creating...")
            cursor.execute(f"CREATE DATABASE {db_name};")
            print(f"Database '{db_name}' created successfully!")
        else:
            print(f"Database '{db_name}' already exists.")
            
        cursor.close()
        conn.close()
        print("Database bootstrapping complete.")
    except Exception as e:
        print(f"Database bootstrap failed: {e}", file=sys.stderr)
        print("Please check if PostgreSQL is running, credentials are correct, or psycopg2 is installed.", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    bootstrap_database()
