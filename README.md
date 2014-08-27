# appsforhere

A [Kraken](http://krakenjs.com/) 1.x based node.js web application to add functionality to PayPal Here and related
PayPal Retail systems. This application uses external APIs only and thus can be customized and deployed
pretty much anywhere.

** PLEASE NOTE **
For improved performance, these modules should be installed globally to ensure native modules where appropriate:

* Node module [mongoose](http://mongoosejs.com/) ~3.8.11
* connect-mongo ~0.4.0
* [canvas](https://github.com/LearnBoost/node-canvas)
* [pm2](https://github.com/unitech/pm2)

And then you must set the NODE_DIR environment variable to your global module directory. We do this to enable git deploy
with the same package.json.

The server also requires the following environment variables:

* PAYPAL_APP_ID - The OAuth appId for PayPal, which needs certain scopes enabled (see the code)
* PAYPAL_APP_SECRET - The app secret for the PAYPAL_APP_ID
* PAYCODE_APP_ID - OAuth appId for the paycode controller
* PAYCODE_APP_SECRET - OAuth app secret for the paycode controller
* PAYCODE_REFRESH_TOKEN - The refresh token issued by PAYCODE_APP_ID to an account capable of doing the paycode dance
* PPS_USERNAME - The old-style three factor PayPal auth username for classic API calls
* PPS_PASSWORD - The old-style three factor PayPal auth password for classic API calls
* PPS_SIGNATURE - The old-style three factor PayPal auth signature for classic API calls
* MAILGUN_KEY - The MailGun API key for email notifications
* TWILIO_AUTH, TWILIO_SID and TWILIO_NUM - The Twilio API authentication and phone number information
