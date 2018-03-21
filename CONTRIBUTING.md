# How to contribute

I'm really glad you're reading this, because we need volunteer developers to help this project come to fruition.

If you haven't already, come find us in Slack ([Dether Slack](https://dether.slack.com). We want you working on things you're excited about.

Here are some important resources:

  * [Dether Slack](https://dether.slack.com). We're usually there during business hours.
  * [SubReddit](https://www.reddit.com/r/Dether/)
  * [Telegram](http://t.me/Dether_io)
  * [Medium blog](https://medium.com/@DETHER) is where we explain our project and do announcements
  * [Twitter](https://twitter.com/dether_io) to follow us
  * [Facebook](https://www.facebook.com/dether.io/) to follow us
  * Mailing list: Join our [mailing list](https://dether.us16.list-manage.com/subscribe/post?u=dd727296ebfd8ba845b23f156&id=f11fdb74cb)
  * Non critical Bug? [Github issue](https://github.com/dethertech/dethercontracts/issues) is where to report them
  * Critical Bug? [Private email](bug@dether.io) is where to report them

## Testing

We are testing the smart contracts with Javascript in async/await style, and the Truffle framework to run them. Please write test examples for new code you create.

## Submitting changes

Please send a [GitHub Pull Request to Dether](https://github.com/dethertech/dethercontracts/pulls) with a clear list of what you've done (read more about [pull requests](http://help.github.com/pull-requests/)). When you send a pull request, we will love you forever if you include tests. We can always use more test coverage. Please follow our coding conventions (below) and make sure all of your commits are atomic (one feature per commit).

Always write a clear log message for your commits. One-line messages are fine for small changes, but bigger changes should look like this:

    $ git commit -m "A brief summary of the commit
    > 
    > A paragraph describing what changed and its impact."

## Coding conventions

Start reading our code and you'll get the hang of it. We optimize for readability:

  * We indent using two spaces (soft tabs)
  * We use async/await for tests