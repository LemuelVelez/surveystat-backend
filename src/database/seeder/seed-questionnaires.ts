import { Pool } from "pg";

import { assertDatabaseConfig, getDatabaseConfig } from "../../lib/db.js";
import { LIKERT_SCALE, QUESTIONNAIRE_FORMS } from "../model/model.js";

async function seedQuestionnaires() {
  assertDatabaseConfig();

  const databaseConfig = getDatabaseConfig();
  const pool = new Pool({
    connectionString: databaseConfig.connectionString,
    ssl: databaseConfig.ssl ? { rejectUnauthorized: false } : false,
  });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const form of QUESTIONNAIRE_FORMS) {
      const formResult = await client.query<{ id: string }>(
        `
          INSERT INTO survey_forms (
            code,
            title,
            description,
            study_title,
            document_header,
            introduction,
            researchers,
            adviser,
            instruction,
            scale,
            voluntary_note,
            signature_label,
            is_active
          )
          VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, $8, $9, $10::jsonb, $11, $12, TRUE)
          ON CONFLICT (code)
          DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            study_title = EXCLUDED.study_title,
            document_header = EXCLUDED.document_header,
            introduction = EXCLUDED.introduction,
            researchers = EXCLUDED.researchers,
            adviser = EXCLUDED.adviser,
            instruction = EXCLUDED.instruction,
            scale = EXCLUDED.scale,
            voluntary_note = EXCLUDED.voluntary_note,
            signature_label = EXCLUDED.signature_label,
            is_active = TRUE,
            updated_at = NOW()
          RETURNING id
        `,
        [
          form.code,
          form.title,
          form.description,
          form.studyTitle,
          JSON.stringify(form.documentHeader),
          form.introduction,
          JSON.stringify(form.researchers),
          form.adviser,
          form.instruction,
          JSON.stringify(LIKERT_SCALE),
          form.voluntaryNote,
          form.signatureLabel,
        ],
      );

      const formId = formResult.rows[0]?.id;

      if (!formId) {
        throw new Error(`Unable to seed survey form: ${form.code}`);
      }

      const activeSectionCodes = form.sections.map((section) => section.code);

      if (activeSectionCodes.length > 0) {
        await client.query(
          `
            DELETE FROM survey_sections
            WHERE form_id = $1
              AND code <> ALL($2::text[])
          `,
          [formId, activeSectionCodes],
        );
      }

      for (const section of form.sections) {
        const sectionResult = await client.query<{ id: string }>(
          `
            INSERT INTO survey_sections (form_id, code, title, sort_order)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (form_id, code)
            DO UPDATE SET
              title = EXCLUDED.title,
              sort_order = EXCLUDED.sort_order,
              updated_at = NOW()
            RETURNING id
          `,
          [formId, section.code, section.title, section.sortOrder],
        );

        const sectionId = sectionResult.rows[0]?.id;

        if (!sectionId) {
          throw new Error(`Unable to seed survey section: ${section.code}`);
        }

        const activeItemCodes = section.items.map((item) => item.code);

        if (activeItemCodes.length > 0) {
          await client.query(
            `
              DELETE FROM survey_items
              WHERE section_id = $1
                AND code <> ALL($2::text[])
            `,
            [sectionId, activeItemCodes],
          );
        }

        for (const item of section.items) {
          await client.query(
            `
              INSERT INTO survey_items (section_id, code, statement, sort_order, is_required)
              VALUES ($1, $2, $3, $4, TRUE)
              ON CONFLICT (code)
              DO UPDATE SET
                section_id = EXCLUDED.section_id,
                statement = EXCLUDED.statement,
                sort_order = EXCLUDED.sort_order,
                is_required = TRUE,
                updated_at = NOW()
            `,
            [sectionId, item.code, item.statement, item.sortOrder],
          );
        }
      }
    }

    await client.query("COMMIT");
    console.log("Questionnaire forms, sections, and items seeded successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedQuestionnaires().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
