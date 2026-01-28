import os

SEAFILE_DOMAIN = os.environ.get("SEAFILE_DOMAIN")

CSRF_TRUSTED_ORIGINS = [f"https://{SEAFILE_DOMAIN}"]

ENABLE_OAUTH = True
OAUTH_CREATE_UNKNOWN_USER = True
OAUTH_ACTIVATE_USER_AFTER_CREATION = True

OAUTH_CLIENT_ID = os.environ.get("OAUTH_CLIENT_ID")
OAUTH_CLIENT_SECRET = os.environ.get("OAUTH_CLIENT_SECRET")
OAUTH_REDIRECT_URL = f"https://{SEAFILE_DOMAIN}/oauth/callback/"  # set as environment variable to pass in so it can be interpolated

OAUTH_PROVIDER = "pocket-id"
OAUTH_PROVIDER_DOMAIN = os.environ.get(
    "OAUTH_PROVIDER_DOMAIN"
)  # these may not be right, check pocket-id and adjust as needed
OAUTH_AUTHORIZATION_URL = os.environ.get("OAUTH_AUTHORIZATION_URL")
OAUTH_TOKEN_URL = os.environ.get("OAUTH_TOKEN_URL")
OAUTH_USER_INFO_URL = os.environ.get("OAUTH_USER_INFO_URL")
OAUTH_SCOPE = ["openid", "profile", "email"]
OAUTH_ATTRIBUTE_MAP = {
    "email": (True, "email"),
    "name": (False, "name"),
    "sub": (False, "uid"),
}

# Optionally set the following variable to automatically redirect users to the login page
LOGIN_URL = f"https://{SEAFILE_DOMAIN}/oauth/login/"

# Enable client to open an external browser for single sign on
# When it is false, the old builtin browser is opened for single sign on
# When it is true, the default browser of the operation system is opened
CLIENT_SSO_VIA_LOCAL_BROWSER = True
