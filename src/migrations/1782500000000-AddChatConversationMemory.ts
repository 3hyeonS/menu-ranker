import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChatConversationMemory1782500000000 implements MigrationInterface {
  name = 'AddChatConversationMemory1782500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`chat_conversation_session\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`userId\` int NOT NULL,
        \`firstHistoryId\` int NOT NULL,
        \`lastHistoryId\` int NOT NULL,
        \`startedAt\` datetime NOT NULL,
        \`lastMessageAt\` datetime NOT NULL,
        \`closedAt\` datetime NULL,
        \`messageCount\` int NOT NULL DEFAULT 0,
        \`summarizedMessageCount\` int NOT NULL DEFAULT 0,
        \`summary\` text NULL,
        \`summaryStatus\` varchar(20) NOT NULL DEFAULT 'PENDING',
        \`summaryUpdatedAt\` datetime NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_chat_conversation_session_user_first_history\` (\`userId\`, \`firstHistoryId\`),
        KEY \`IDX_chat_conversation_session_user_last_message\` (\`userId\`, \`lastMessageAt\`),
        KEY \`IDX_chat_conversation_session_user_summary_closed\` (\`userId\`, \`summaryStatus\`, \`closedAt\`),
        CONSTRAINT \`FK_chat_conversation_session_user\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE \`chat_user_memory\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`userId\` int NOT NULL,
        \`profileTraits\` text NULL,
        \`lastCompactedAt\` datetime NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_chat_user_memory_user\` (\`userId\`),
        CONSTRAINT \`FK_chat_user_memory_user\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `chat_user_memory`');
    await queryRunner.query('DROP TABLE `chat_conversation_session`');
  }
}
