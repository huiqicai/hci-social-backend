# HCI-Social Backend
Backend/API layer for the UB CSE370 course project

## Getting Started
First install the dependencies:
- `npm install`

To customize the DB connection strings used for each API tenant, copy `db-tenants.example.json`
to `db-tenants.json` and fill it out as appropriate.

If you want to set a API prefix or listen socket/port, create a file called
`.env.local` and set the relevant values, using the defaults set in `.env` as an example.

From there, there are two different ways to start the app

### Development
The simplest way to get started is by running `npm run develop`. This will start the application
in development mode, which configures the app appropriately for a local install and reloads itself
if any changes are made. The API will be available at `http://localhost:3001/api/<tenantID>`, and the Swagger UI
documentation will be available at http://localhost:3001/swagger

Note that if there are any unapplied database migrations, you will still need to apply them via
`npm run push-schema` or `npm run migrate`.

### Production 
- `npm run build` to build the typescript to javascript
- `npm run migrate` to apply any unapplied DB migrations
- `npm start` to run the app in production mode

## Development Scripts
- `npm run reset-db` Clears all data in DB
- `npm run push-schema` If updating the DB schema, updates your local database to match and regenerates the Prisma client
- `npm run make-migrations` If updating the DB schema, generates migrations and runs them against your local database
- `npm run lint` Run ESLint to find any code style problems
- `npm run lint-fix` Run ESLint and automatically fix issues where possible
- `npm run test` Run mocha unit tests
- `npm run e2e` Run mocha end to end tests

## Framework Documentation
- [FoalTS](https://foalts.org/docs/) - API framework
- [Prisma](https://prisma.io/) - ORM (DB interface)
