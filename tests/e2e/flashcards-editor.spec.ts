import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { audioFile, imageFile, videoFile } from './fixtures/media';

function readAdminPassword() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return '';
  const content = fs.readFileSync(envPath, 'utf8');
  const match = content.match(/^ADMIN_PASSWORD=(.+)$/m);
  return match?.[1]?.trim() ?? '';
}

async function getFlashcardId(page: Page, title: string) {
  return page.evaluate(async (cardTitle) => {
    const response = await fetch('/api/flashcards', { cache: 'no-store' });
    const data = await response.json();
    const card = (data.flashcards ?? []).find((item: { id: string; title: string }) => item.title === cardTitle);
    return card?.id ?? null;
  }, title);
}

async function getTextPreviewRuns(page: Page) {
  return page.getByTestId('text-block-rich-preview').evaluate((node) =>
    Array.from(node.querySelectorAll('span'))
      .filter((element) => element.children.length === 0 && element.textContent?.trim())
      .map((element) => {
        const style = window.getComputedStyle(element);
        return {
          text: element.textContent?.trim() ?? '',
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          fontStyle: style.fontStyle,
          color: style.color,
        };
      })
  );
}

test('flashcard editor supports mixed text styles, step insertion, and media uploads', async ({ page }) => {
  const adminPassword = readAdminPassword();
  test.skip(!adminPassword, 'ADMIN_PASSWORD is required for the local smoke test.');

  const title = `e2e-${Date.now()}`;
  let flashcardId: string | null = null;

  try {
    await page.goto('/login');
    await page.getByTestId('login-username').fill('admin');
    await page.getByTestId('login-password').fill(adminPassword);
    await page.getByTestId('login-submit').click();
    await page.waitForURL('**/dashboard');

    await page.goto('/flashcards/editor');
    await page.locator('input').first().fill(title);

    const appendStepButton = page.locator('[data-testid="step-rail"]').locator('xpath=../following-sibling::div//button');
    await appendStepButton.click();
    await appendStepButton.click();
    await expect(page.getByTestId('step-thumbnail')).toHaveCount(3);

    await page.getByTestId('insert-slot-1').hover();
    await page.getByTestId('insert-step-button-1').click();
    await expect(page.getByTestId('step-thumbnail')).toHaveCount(4);

    await page.getByTestId('toolbar-text').click();
    await page.getByTestId('text-block-editor').click();
    await page.keyboard.type('First line');
    await page.keyboard.press('Enter');
    await page.getByTestId('text-style-font-size').selectOption('24');
    await page.getByTestId('text-style-bold').click();
    await page.getByTestId('text-style-italic').click();
    await page.getByTestId('text-color-2563eb').click();
    await page.keyboard.type('Second line');

    await page.getByTestId('step-thumbnail').first().click();
    await page.getByTestId('step-thumbnail').nth(1).click();
    await expect(page.getByTestId('text-block-preview')).toContainText('First line');
    await expect(page.getByTestId('text-block-preview')).toContainText('Second line');
    expect(await getTextPreviewRuns(page)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        text: 'First line',
        fontSize: '14px',
        fontWeight: '400',
        fontStyle: 'normal',
        color: 'rgb(31, 41, 55)',
      }),
      expect.objectContaining({
        text: 'Second line',
        fontSize: '24px',
        fontWeight: '700',
        fontStyle: 'italic',
        color: 'rgb(37, 99, 235)',
      }),
    ]));

    await page.getByTestId('toolbar-image').click();
    await page.getByTestId('media-file-input').setInputFiles(imageFile);
    await expect(page.getByTestId('canvas-image-block')).toHaveCount(1);

    await page.getByTestId('toolbar-video').click();
    await page.getByTestId('media-file-input').setInputFiles(videoFile);
    await expect(page.getByTestId('canvas-video-block')).toHaveCount(1);

    await page.getByTestId('toolbar-audio').click();
    await page.getByTestId('media-file-input').setInputFiles(audioFile);
    await expect(page.getByTestId('canvas-audio-block')).toHaveCount(1);

    await page.getByTestId('flashcard-save').click();
    await page.waitForURL('**/flashcards');

    flashcardId = await getFlashcardId(page, title);
    expect(flashcardId).toBeTruthy();

    await page.goto(`/flashcards/editor?id=${flashcardId}`);
    await expect(page.getByTestId('step-thumbnail')).toHaveCount(4);
    await page.getByTestId('step-thumbnail').nth(1).click();
    await expect(page.getByTestId('text-block-preview')).toContainText('First line');
    await expect(page.getByTestId('text-block-preview')).toContainText('Second line');
    expect(await getTextPreviewRuns(page)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        text: 'First line',
        fontSize: '14px',
        fontWeight: '400',
        fontStyle: 'normal',
        color: 'rgb(31, 41, 55)',
      }),
      expect.objectContaining({
        text: 'Second line',
        fontSize: '24px',
        fontWeight: '700',
        fontStyle: 'italic',
        color: 'rgb(37, 99, 235)',
      }),
    ]));
    await expect(page.getByTestId('canvas-image-block')).toHaveCount(1);
    await expect(page.getByTestId('canvas-video-block')).toHaveCount(1);
    await expect(page.getByTestId('canvas-audio-block')).toHaveCount(1);
  } finally {
    if (flashcardId) {
      await page.evaluate(async (id) => {
        await fetch(`/api/flashcards/${id}`, { method: 'DELETE' });
      }, flashcardId);
    }
  }
});

test('flashcard editor shows the upload API error without inserting media blocks', async ({ page }) => {
  const adminPassword = readAdminPassword();
  test.skip(!adminPassword, 'ADMIN_PASSWORD is required for the local smoke test.');

  let uploadRequests = 0;

  await page.route('**/api/upload', async (route) => {
    uploadRequests += 1;
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'Upload service is misconfigured.',
        code: 'UPLOAD_CONFIG_ERROR',
      }),
    });
  });

  await page.goto('/login');
  await page.getByTestId('login-username').fill('admin');
  await page.getByTestId('login-password').fill(adminPassword);
  await page.getByTestId('login-submit').click();
  await page.waitForURL('**/dashboard');

  await page.goto('/flashcards/editor');
  await page.locator('input').first().fill(`e2e-upload-error-${Date.now()}`);

  await page.getByTestId('toolbar-image').click();
  await page.getByTestId('media-file-input').setInputFiles(imageFile);

  await expect(page.getByText('Upload service is misconfigured.').first()).toBeVisible();
  await expect(page.getByTestId('canvas-image-block')).toHaveCount(0);
  expect(uploadRequests).toBe(1);
});
