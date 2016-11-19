import tensorflow as tf
import numpy as np
import math

import time
import sys

from model import Model
from data import Data

dataset = Data('/code/src.js')

n_cells = 1
n_hidden = 256

model = Model(dataset.vocab_size, n_cells, n_hidden)

def sample(sess, start, n):
    state = sess.run(model.initial_state)
    text = "" + start
    char = dataset.chars.index(text[0])
    for i in range(n):
        feed = model.get_feed_generate(char, state)
        res, state = sess.run([model.output, model.final_state], feed)
        if i<len(text):
            char = dataset.chars.index(text[i])
        else:
            char = res[0]
            text += dataset.chars[res[0]]
    return text

saver = tf.train.Saver()

with tf.Session() as sess:
    sess.run(model.init_op)

    print "starting"

    for epoch in range(100):
        state = sess.run(model.initial_state)
        epoch_start = batch_start = time.clock()
        for i in range(len(dataset.data)):
        # for i in range(100000):
            feed = model.get_feed(dataset.data, i, state)
            _, state = sess.run([model.train_op, model.final_state], feed)

            # if i%1000 == 0:
            #     print epoch, i
            #    sys.stdout.flush()

            if i%10000 == 0:
              print i, sample(sess, "fun", 100)
              sys.stdout.flush()

        print epoch, (time.clock() - epoch_start)
        sys.stdout.flush()
        epoch_start = time.clock()

        # save_path = saver.save(sess, "/code/lstm/checkpoints/train_epoch", global_step=epoch)

        print sample(sess, "fun", 100)
        print
        sys.stdout.flush()
