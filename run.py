from app import create_app

app = create_app()

if __name__ == '__main__':
    # Start server using config settings loaded in the app object
    port = app.config.get('PORT', 5001)
    debug = app.config.get('DEBUG', True)
    app.run(host='0.0.0.0', port=port, debug=debug)
