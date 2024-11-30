import fs from "fs";
import stream from "stream";
import { Pool, PoolClient } from "pg";
import { from as copyFrom } from "pg-copy-streams";

import { DrugDbRepository } from "../interfaces/drug-db-repository";

export class PgDrugDbRepository implements DrugDbRepository {
  private conn: Pool;
  private client: PoolClient;

  constructor() {
    this.conn = new Pool({
      host: process.env.DATABASE_HOST,
      port: Number(process.env.DATABASE_PORT),
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASS,
      database: process.env.DATABASE_NAME,
    });
  }

  buildCopyQuery(tableName: string): stream.Writable {
    const query = `
      COPY ${tableName}
      FROM STDIN
      WITH DELIMITER '|' NULL AS '' ENCODING 'ISO88591'
    `;
    return this.client.query(copyFrom(query));
  }

  async streamToTable(
    fileStream: fs.ReadStream,
    tableName: string
  ): Promise<void> {
    this.client = await this.conn.connect();
    const copyStream = this.buildCopyQuery(tableName);

    try {
      fileStream.pipe(copyStream);

      await new Promise<void>((resolve, reject) => {
        copyStream.on("finish", resolve);
        copyStream.on("error", reject);
        fileStream.on("error", reject);
      });
    } finally {
      this.client.release();
    }
  }

  async closeConnection(): Promise<void> {
    await this.conn.end();
  }
}