# Stage 1: Build the Go application
FROM golang:1.26-alpine AS builder

WORKDIR /app

# Install Node.js/npm, esbuild, sass for JS/CSS rebuild
RUN apk add --no-cache nodejs npm make && npm install -g esbuild sass

# Copy go mod and sum files
COPY go.mod go.sum ./

# Download all dependencies. Dependencies will be cached if the go.mod and go.sum files are not changed
RUN go mod download

# Copy the source from the current directory to the Working Directory inside the container
COPY . .

# Rebuild JS/CSS assets, then build the Go binary
RUN make generate && go build -ldflags="-s -w" -o goshs .

# Stage 2: Create a minimal runtime image
FROM alpine:latest

# Set the Current Working Directory inside the container
WORKDIR /root/

# Copy the Pre-built binary file from the previous stage
COPY --from=builder /app/goshs .

# Coverage drop dir: integration tests bind-mount a host path here and
# read the emitted covdata after the container shuts down gracefully.
# The dir is world-writable so the non-root user (1000:1000) the tests
# run as can write to it.
ENV GOCOVERDIR=/covdata
RUN mkdir -p /covdata && chmod 0777 /covdata

# Command to run the executable
ENTRYPOINT ["./goshs"]
