import tensorflow as tf
import cPickle, gzip, numpy
import math
import sys

# hyper parameters
learning_rate = 0.001
batch_size = 128

# Load the dataset
f = gzip.open('/code/mnist.pkl.gz', 'rb')
train_set, valid_set, test_set = cPickle.load(f)
f.close()

print "data loaded"
sys.stdout.flush()

# inputs
# MLP 256, tanh
# MLP 64, tanh

def layer(x, n_in, n_out, activation=tf.nn.relu):
    W = tf.Variable(tf.truncated_normal([n_in, n_out], stddev=1.0 / math.sqrt(float(n_in))))
    # W = tf.Variable(tf.truncated_normal([n_in, n_out], stddev=0.1))
    b = tf.Variable(tf.constant(0.1, shape=[n_out]))
    return activation(tf.matmul(x, W) + b)

def conv2d(x, filter_shape):
    W = tf.Variable(tf.truncated_normal(filter_shape, stddev=0.1))
    b = tf.Variable(tf.constant(0.1, shape=[filter_shape[-1]]))
    return tf.nn.relu(tf.nn.conv2d(x, W, [1,1,1,1], padding='SAME') + b)

def pool2d(x):
    return tf.nn.max_pool(x, ksize=[1, 2, 2, 1], strides=[1, 2, 2, 1], padding='SAME')

x = tf.placeholder(tf.float32, [None, 784])
image = tf.reshape(x, [-1, 28, 28, 1])
conv1 = conv2d(image, [5,5,1,32])
pool1 = pool2d(conv1)
conv2 = conv2d(pool1, [5,5,32,64])
pool2 = pool2d(conv2)
flat = tf.reshape(pool2, [-1, 7*7*64])
h = layer(flat, 7*7*64, 1024)
prob_keep = tf.placeholder(tf.float32)
drop = tf.nn.dropout(h, prob_keep)
y_ = layer(drop, 1024, 10, activation=tf.nn.softmax)

# h1 = layer(x, 784, 256)
# h2 = layer(h1, 256, 64)
#y_ = layer(h2, 64, 10, activation=tf.nn.softmax)

y = tf.placeholder(tf.float32, [None, 10])

cross_entropy = -tf.reduce_sum(y * tf.log(y_), 1)
loss = tf.reduce_mean(cross_entropy)

errors = tf.reduce_sum( tf.cast(tf.not_equal(tf.argmax(y, 1), tf.argmax(y_, 1)), tf.float32) )

# train_op = tf.train.GradientDescentOptimizer(learning_rate).minimize(loss)
train_op = tf.train.AdamOptimizer(0.001).minimize(loss)
init_op = tf.initialize_all_variables()

def onehot(x, n):
    a = [0.0] * n
    a[x] = 1.0
    return a

with tf.Session() as sess:
    sess.run(init_op)

    for epoch in range(100):
        batches = len(train_set[0])/batch_size
        for i in range(batches):
            train_x = train_set[0][i*batch_size:(i+1)*batch_size]
            train_y = [onehot(v, 10) for v in train_set[1][i*batch_size:(i+1)*batch_size]]

            _, loss_value, num_errors = sess.run([train_op, loss, errors], {x: train_x, y: train_y, prob_keep: 0.5})
            print epoch, i, loss_value, num_errors
            sys.stdout.flush()

            if loss_value<0.01:
                break

        if loss_value<0.01:
            break

    # evaluating on valid_set
    num_errors = sess.run(errors, {x: valid_set[0][:1000], y: [onehot(v, 10) for v in valid_set[1][:1000]], prob_keep: 1.0})
    print num_errors, len(valid_set[0])
    sys.stdout.flush()
