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
Before you run this demo application you will need to do some configuration. Update `config.env` with a `CLUSTER_ID` and the path to a UFP file. A `CLUSTER_ID` can be found by visiting a printer's page in Digital Factory and taking the long ID after the `https://digitalfactory.ultimaker.com/app/jobs/` URL.

Now just run:
```sh
npm install

npm run start
```

Once it has started you must open the login URL shown in the console/terminal in your web browser, then you can log in to Digital Factory. Once logged in the actions will be performed automatically.
