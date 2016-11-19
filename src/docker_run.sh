#!/bin/bash

echo "Running $1"
docker run --rm -i -v ${PWD}:/code gcr.io/tensorflow/tensorflow:latest-devel bash -c "python /code/$1"
