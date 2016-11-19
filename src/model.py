import tensorflow as tf
import numpy as np
import math

class Model():

    def __init__(self, vocab_size, n_cells, n_hidden):
        self.vocab_size = vocab_size

        self.x = x = tf.placeholder(tf.float32, [1, vocab_size])
        self.y = y = tf.placeholder(tf.float32, [None, vocab_size])

        lstm = tf.nn.rnn_cell.LSTMCell(n_hidden, state_is_tuple=True)
        cell = tf.nn.rnn_cell.MultiRNNCell([lstm] * n_cells, state_is_tuple=True)
        self.initial_state = cell.zero_state(1, tf.float32)

        output, final_state = cell(x, self.initial_state)
        self.final_state = final_state

        self.prob_keep = prob_keep = tf.placeholder(tf.float32)
        output = tf.nn.dropout(output, prob_keep)

        weights = tf.Variable(tf.truncated_normal([n_hidden, vocab_size]))
        bias = tf.Variable(tf.constant(0.1, shape=[vocab_size]))

        pred = tf.nn.softmax(tf.matmul(output, weights) + bias)
        cross_entropy = -tf.reduce_sum(y * tf.log(pred))
        self.output = tf.argmax(pred, 1)

        optimizer = tf.train.AdamOptimizer(0.0001)
        gvs = optimizer.compute_gradients(cross_entropy)
        capped_gvs = [(tf.clip_by_value(grad, -1., 1.), var) for grad, var in gvs]
        self.train_op = optimizer.apply_gradients(capped_gvs)

        self.init_op = tf.initialize_all_variables()

    def sample(self, sess, start, n):
        state = sess.run(self.initial_state)
        text = "" + start
        char = chars.index(text[0])
        for i in range(30):
            feed = get_feed_generate(char, state)
            res, state = sess.run([sel, final_state], feed)
            # print chars[res[0]],
            if i<len(text):
                char = chars.index(text[i])
            else:
                char = res[0]
                text += chars[res[0]]
        return text

    def features(self, d):
        fs = np.zeros(self.vocab_size) #[0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0]
        fs[d] = 1.0
        return fs

    def get_feed(self, data, i, state):
        feed_dict = {
            self.x: [self.features(data[i % len(data)])],
            self.y: [self.features(data[(i + 1) % len(data)])],
            self.prob_keep: 0.5
        }
        for i, (c, h) in enumerate(self.initial_state):
          feed_dict[c] = state[i].c
          feed_dict[h] = state[i].h

        return feed_dict

    def get_feed_generate(self, char, state):
        feed_dict = {
            self.x: [self.features(char)],
            self.prob_keep: 1.0
        }
        for i, (c, h) in enumerate(self.initial_state):
          feed_dict[c] = state[i].c
          feed_dict[h] = state[i].h

        return feed_dict
