package handler

import "testing"

func TestDefaultPassword(t *testing.T) {
	tests := []struct {
		email string
		want  string
	}{
		{"a@b.com", "a@b"},
		{"zhangsan@company.com", "zhangsan@company"},
		{"user@mail.company.com.cn", "user@mail.company.com"},
		{"user@sub.example.com", "user@sub.example"},
		{"noemail", "noemail"},
		{"a.b", "a"},
		{"user@", "user@"},
		{"@domain.com", "@domain"},
	}

	for _, tt := range tests {
		got := defaultPassword(tt.email)
		if got != tt.want {
			t.Errorf("defaultPassword(%q) = %q, want %q", tt.email, got, tt.want)
		}
	}
}
