# Final Project Learnings 

## Overview

Our final project is an API that allows users to not only create unique Spotify playlists but also add them to a useful Airtable table (think spreadsheet-like). More specifically, our API allows users to create a playlist with liked songs within a specified date range. How that works is that one of the API routes takes in a date range (eg between '2020.04.01' and '2020.04.22) and then creates a Spotify playlist under your account with all the songs that you've liked in that range. After it creates that Spotify playlist, it also adds all those songs to an Airtable, and registers that playlist in Airtable. One other function of our application is to take any playlist in Spotify and add all its songs into Airtable as well.

Inside Airtable, there are 3 tables: Users, Playlists, and Songs. Once a user authenticates, they get added to the user table. In the process of making a playlist, the playlist is first added to the playlist table, then the songs to the songs table, then the associate between the songs and the playlist, and then finally the association between the user, songs, and playlist. One final note about our API is that we didn't use flask, we used an Express (Node.js) server!

## Takeaways

In terms of what we learned, there were a lot of takeaways. Since our API was written in Javascript, we ran into a lot of asynchronous issues. More concretely, there were multiple times where we chained API's and saw actions finishing before we wanted them to, such as the second API call happening before the first one finished. We were able to resolve this but utilizing something called Promises, which basically allow Javascript to wait for the completion of an API call before continuing. We also learned that there is another way to work with asynchronous code, which is by adding the tag 'await' before we made those calls.

Airtable is interesting because it is a database but is also able to do a lot of heavy-lifting on its server side. It comes packed full of features such as formulas, linked-record lookups, and more! We thought it'd be very cool to be able to analyze and inspect the data that our Spotify libraries reveals (once we port it to Airtable).

Another nice benefit of using Airtable is that we can see which users are associated with a particular song, since (just as Spotify does), Songs are a separate table. Thus, we don't need to create more than one representation of a song object - instead it should be shared between all users that have saved it or have it in a playlist.

## Unexpected issues

With Airtable, there are some quirks - Airtable does not gracefully handle duplicate foreign-key IDs as we had expected, so we needed to handle that carefully to avoid the Airtable API throwing errors.

Using the `async/await` syntax makes code a lot prettier, but it introduces its own issues - that is, uncaught exceptions. Robust error handling is difficult when you are no longer specifying a callback for each API call. We found it useful to separate out logical sets of API calls in helper functions that had their own `try/catch` blocks.

Spotify has an example auth flow on its Web API Quickstart page, but we found that it did not translate very well to our Node app; it was bulky and stylistically difficult to parse. We spent some time refactoring the existing code. Notably, once the naive flow worked, we decided to integrate a convenient wrapper API to abstract away some of the repetitive tasks in order to effectively utilize the Spotify API.

## Next steps

Add more fun functionality with various endpoints! With the existing endpoints, we've established the building blocks to do much more with the Spotify API and a linked Airtable base. We can expand what attributes we store in Airtable if we like, or add more tables. Finally, of course we could always build out a lightweight frontend.