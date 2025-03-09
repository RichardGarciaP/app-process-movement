require('dotenv').config();
const { Kafka } = require('kafkajs');
const MongoClient = require('mongodb').MongoClient;

const kafka = new Kafka({
  clientId: 'movement-client',
  brokers: [process.env.KAFKA_SERVER],
});

const mongodb = new MongoClient(process.env.DB_MONGO_URI);

kafka_consumer();

async function kafka_consumer() {
  const consumer = kafka.consumer({
    groupId: 'movement-subscription',
    allowAutoTopicCreation: true,
  });
  await consumer.connect();
  await consumer.subscribe({ topic: 'transaction-topic', fromBeginning: true });
  await consumer.run({
    autoCommit: false,
    eachMessage: async ({ topic, partition, message }) => {
      console.log({ value: message.value.toString() });
      var jsonObj = JSON.parse(message.value.toString());
      mongodb.connect().then((res) => {
        const db = mongodb.db(process.env.DB_MONGO_DATABASE_MOVEMENT);
        db.collection('movement')
          .insertOne(jsonObj)
          .then(async (res) => {
            console.log(
              `Movement registered with accountId: ${jsonObj.accountId}`
            );
            await consumer.commitOffsets([
              {
                topic,
                partition,
                offset: (Number(message.offset) + 1).toString(),
              },
            ]);
            console.log(`Commit message with accountId: ${jsonObj.accountId}`);
          })
          .catch((err) => console.error('Error executing query', err.stack));
      });
    },
  });
}
