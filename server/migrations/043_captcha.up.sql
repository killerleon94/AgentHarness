CREATE TABLE captcha (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    answer VARCHAR(10) NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_captcha_answer ON captcha (answer, used, expires_at);
CREATE INDEX idx_captcha_expires ON captcha (expires_at) WHERE used = FALSE;