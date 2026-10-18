import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { BitbucketAuthType } from "@/components/project/bitbucket-integration/bitbucket-access";
import { BitbucketAuthTypeSelect } from "@/components/project/bitbucket-integration/bitbucket-auth-type-select";
import { SetupField } from "@/components/project/code-hosting/setup-field";
import { Input } from "@/components/ui/input";

type BitbucketCredentialFieldsProps = {
  authType: BitbucketAuthType;
  email: string;
  disabled: boolean;
  onAuthTypeChange: (value: BitbucketAuthType) => void;
  onEmailChange: (value: string) => void;
};

// The token type and, for an API token, the account email. The token input
// itself differs between setup and rotation, so callers render it.
export function BitbucketCredentialFields({
  authType,
  email,
  disabled,
  onAuthTypeChange,
  onEmailChange,
}: BitbucketCredentialFieldsProps) {
  const { t } = useTranslation();
  const id = useId();

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <SetupField
        label={t("settings:bitbucketIntegration.authTypeLabel")}
        htmlFor={`${id}-type`}
      >
        <BitbucketAuthTypeSelect
          id={`${id}-type`}
          value={authType}
          disabled={disabled}
          onChange={onAuthTypeChange}
        />
      </SetupField>
      {authType === "api_token" ? (
        <SetupField
          label={t("settings:bitbucketIntegration.emailLabel")}
          htmlFor={`${id}-email`}
        >
          <Input
            id={`${id}-email`}
            type="email"
            autoComplete="off"
            placeholder="name@example.com"
            value={email}
            disabled={disabled}
            onChange={(event) => onEmailChange(event.target.value)}
          />
        </SetupField>
      ) : null}
    </div>
  );
}
