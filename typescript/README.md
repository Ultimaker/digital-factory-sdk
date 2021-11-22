## TypeScript demo

This program demonstrates how to perform an OAuth2 login as a client application, obtain and Access Token and then use to authorize requests to the Digital Factory API.

It demonstrates a number of actions:

* Creating a project
* Adding comments to a project
* Uploading a file to a project
* Submitting a print job
* Querying the list of running print jobs
* Searching through projects


# How to run
Before you run this demo application make sure you have configured it properly. First you need to add a `.env` file in the `secrets` folder and populate it using the `example.env` file. After that just run:
```sh
npm install

npm run start
```

Once it has started you must open the login URL shown in the console/terminal in your web browser, then you can log in to Digital Factory. Once logged in the actions will be performed automatically.
