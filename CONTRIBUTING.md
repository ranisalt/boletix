# Contributing

Sign off every commit with `git commit -s`. This adds a line like this to the message:

```
Signed-off-by: Your Name <you@example.com>
```

By signing off you agree to the [Developer Certificate of Origin](https://developercertificate.org): you wrote the change or have the right to submit it, and you submit it under the license of the files it touches (see [NOTICE.md](NOTICE.md)).

Before opening a pull request, run:

```sh
pnpm check
pnpm lint
pnpm test
```
