FROM golang:1.24-alpine AS build
WORKDIR /src
COPY go.mod ./
COPY *.go index.html style.css game.js ./
COPY assets ./assets
RUN CGO_ENABLED=0 go build -o /hamster-chariot .

FROM alpine:3.20
COPY --from=build /hamster-chariot /usr/local/bin/hamster-chariot
VOLUME /data
EXPOSE 8080
CMD ["hamster-chariot", "-addr", ":8080", "-scores", "/data/scores.json", "-behind-proxy"]
