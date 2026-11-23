import { expect, test, type Page } from "@playwright/test";
import { E2E_ADMIN } from "./global-setup";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(E2E_ADMIN.email);
  await page.getByLabel("Senha").fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Visão geral" })).toBeVisible();
}

test.describe("acesso", () => {
  test("rotas protegidas exigem login e não há cadastro público", async ({ page, request }) => {
    await page.goto("/financeiro");
    await expect(page).toHaveURL(/\/login\?next=%2Ffinanceiro/);
    await expect(page.getByText(/criar conta|cadastre-se/i)).toHaveCount(0);
    const api = await request.get("/api/anexos/qualquer");
    expect(api.status()).toBe(401);
    // cookie forjado não passa da validação no servidor
    await page.context().addCookies([{ name: "vs_session", value: "forjado", url: "http://localhost:3100" }]);
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("senha errada mostra erro genérico", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(E2E_ADMIN.email);
    await page.getByLabel("Senha").fill("senha-incorreta-xyz");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
  });
});

test.describe("financeiro", () => {
  test("conta, venda parcelada, despesa a pagar, baixa e relatórios", async ({ page }, info) => {
    const tag = info.project.name;
    await login(page);

    // Conta bancária
    await page.goto("/configuracoes/contas");
    await page.getByLabel("Nome").fill(`Banco ${tag}`);
    await page.getByLabel("Saldo inicial (R$)").fill("1.000,00");
    await page.getByLabel("Data do saldo inicial").fill("2020-01-01");
    await page.getByRole("button", { name: "Cadastrar" }).click();
    await expect(page.getByText("Conta salva.")).toBeVisible();

    // Venda no cartão em 3x, primeira parcela recebida
    await page.goto("/financeiro/novo?tipo=entrada");
    await page.getByLabel("Descrição").fill(`Venda cartão ${tag}`);
    await page.getByLabel("Valor total").fill("300");
    await page.getByLabel("Categoria").selectOption({ label: "Vendas" });
    await page.getByLabel("Operação").selectOption({ label: "Quiosque 1" });
    await page.getByRole("radio", { name: "Parcelado" }).click();
    await page.getByLabel("Nº de parcelas").fill("3");
    await page.getByLabel("Forma de pagamento").selectOption({ label: "Cartão de crédito" });
    await page.getByLabel("Conta prevista (opcional)").selectOption({ label: `Banco ${tag}` });
    await expect(page.getByText("Soma R$ 300,00")).toBeVisible();
    await page.getByRole("button", { name: "Registrar entrada" }).click();
    await expect(page.getByText("Lançamento salvo.")).toBeVisible();
    await expect(page.getByText("Parcelas (3)")).toBeVisible();

    // Baixa da 1ª parcela com taxa
    await page.getByRole("button", { name: "Registrar recebimento" }).first().click();
    await page.getByLabel("Taxa descontada").fill("3,50");
    await page.getByRole("button", { name: "Confirmar baixa" }).click();
    await expect(page.getByText("Recebida", { exact: true })).toBeVisible();
    await expect(page.getByText(/taxa R\$ 3,50 · líquido R\$ 96,50/)).toBeVisible();

    // Despesa a pagar
    await page.goto("/financeiro/novo?tipo=saida");
    await page.getByLabel("Descrição").fill(`Boleto matéria-prima ${tag}`);
    await page.getByLabel("Valor total").fill("150,00");
    await page.getByLabel("Categoria").selectOption({ label: "Matérias-primas" });
    await page.getByLabel("Operação").selectOption({ label: "Central / administrativo" });
    await page.getByRole("radio", { name: "A pagar" }).click();
    await page.getByRole("button", { name: "Registrar saída" }).click();
    await expect(page.getByText("Lançamento salvo.")).toBeVisible();

    // Aparece em contas a pagar
    await page.goto("/financeiro/a-pagar");
    await expect(page.getByText(`Boleto matéria-prima ${tag}`)).toBeVisible();

    // Validação no cliente: sem categoria
    await page.goto("/financeiro/novo?tipo=saida");
    await page.getByLabel("Descrição").fill("Sem categoria");
    await page.getByLabel("Valor total").fill("10");
    await page.getByRole("button", { name: "Registrar saída" }).click();
    await expect(page.getByRole("alert").first()).toContainText("categoria");

    // Relatório de resultado: faturamento conta a venda uma única vez
    await page.goto("/financeiro/relatorios?aba=resultado&p=month");
    await expect(page.getByRole("row", { name: /Faturamento \(receita bruta/ })).toContainText(tag === "celular" ? "R$ 300,00" : "R$ 600,00");
    await expect(page.getByText("Estimado")).toBeVisible();

    // Dashboard renderiza com gráfico
    await page.goto("/?p=month");
    await expect(page.getByText("Resultado do período")).toBeVisible();
    await page.screenshot({ path: `test-results/dashboard-${tag}.png`, fullPage: true });
  });

  test("sem rolagem horizontal nas principais telas", async ({ page }) => {
    await login(page);
    for (const path of ["/", "/financeiro", "/financeiro/novo", "/financeiro/a-pagar", "/financeiro/relatorios", "/financeiro/relatorios?aba=operacoes", "/configuracoes/seguranca"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });

  test("logout encerra a sessão", async ({ page, isMobile }) => {
    await login(page);
    if (isMobile) {
      await page.getByRole("button", { name: "Mais" }).click();
      await page.getByRole("button", { name: "Sair" }).click();
    } else {
      await page.getByRole("button", { name: "Sair" }).click();
    }
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/financeiro");
    await expect(page).toHaveURL(/\/login/);
  });
});

test("capturas das telas principais", async ({ page }, info) => {
  await login(page);
  await page.goto("/financeiro/novo?tipo=entrada");
  await page.getByRole("radio", { name: "Parcelado" }).click();
  await page.screenshot({ path: `test-results/form-${info.project.name}.png`, fullPage: true });
  await page.goto("/financeiro");
  await page.screenshot({ path: `test-results/lista-${info.project.name}.png`, fullPage: true });
  await page.goto("/financeiro/relatorios?aba=resultado");
  await page.screenshot({ path: `test-results/dre-${info.project.name}.png`, fullPage: true });
});
