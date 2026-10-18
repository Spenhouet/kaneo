import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { BitbucketAuthType } from "@/components/project/bitbucket-integration/bitbucket-access";
import { BitbucketCredentialFields } from "@/components/project/bitbucket-integration/bitbucket-credential-fields";
import { SetupField } from "@/components/project/code-hosting/setup-field";
import { IntegrationStep } from "@/components/project/integrations/panel/integration-step";
import { Input } from "@/components/ui/input";

type BitbucketSignInStepProps = {
  authType: BitbucketAuthType;
  email: string;
  token: string;
  disabled: boolean;
  onAuthTypeChange: (value: BitbucketAuthType) => void;
  onEmailChange: (value: string) => void;
  onTokenChange: (value: string) => void;
};

export function BitbucketSignInStep({
  authType,
  email,
  token,
  disabled,
  onAuthTypeChange,
  onEmailChange,
  onTokenChange,
}: BitbucketSignInStepProps) {
  const { t } = useTranslation();
  const id = useId();

  return (
    <IntegrationStep
      number={1}
      title={t("settings:bitbucketIntegration.signInTitle")}
      description={t("settings:bitbucketIntegration.signInDescription")}
    >
      <BitbucketCredentialFields
        authType={authType}
        email={email}
        disabled={disabled}
        onAuthTypeChange={onAuthTypeChange}
        onEmailChange={onEmailChange}
      />
      <SetupField
        label={t("settings:bitbucketIntegration.tokenLabel")}
        htmlFor={`${id}-token`}
      >
        <Input
          id={`${id}-token`}
          type="password"
          autoComplete="off"
          placeholder={t("settings:bitbucketIntegration.tokenPlaceholder")}
          value={token}
          disabled={disabled}
          onChange={(event) => onTokenChange(event.target.value)}
        />
      </SetupField>
    </IntegrationStep>
  );
}
