class Data():
    def __init__(self, filename):
        with open(filename, 'r') as myfile:
            data = myfile.read()

        self.chars = chars = list(set(data))
        self.vocab_size = len(chars)

        self.data = [chars.index(c) for c in data]
