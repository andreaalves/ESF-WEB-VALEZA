import {
  SimpleGrid as SimpleGridBase,
  Divider as DividerBase,
  Text as TextBase,
} from '@chakra-ui/react';
import { InputCustom } from '../InputCustom/InputCustom';
import { SelectCustom } from '../selectCustom/SelectCustom';
import { cnpjAlfanumericoMask } from '../../helpers/cnpjAlfanumericoMask';
import { phoneMask } from '../../helpers/phoneMask';
import { cepMask } from '../../helpers/cepMask';
import { currencyMask } from '../../helpers/currencyMask';

// Chakra UI v1 + TS strict estoura TS2590 ("union type too complex") quando
// uma página mistura muitos componentes. Casting para any contorna o limite.
const SimpleGrid = SimpleGridBase as any;
const Divider = DividerBase as any;
const Text = TextBase as any;

interface EmpresaFormFieldsProps {
  register: any;
  control: any;
  errors: any;
  isReadOnly?: boolean;
}

// Campos de cadastro da empresa (PDEV-27), embutidos na tela de
// Parametrização (CreateParams). Nomes dos campos batem 1:1 com o payload que
// POST /cadastrar-empresas espera (ver mapeamento de submit em onSubmitEmpresa).
export function EmpresaFormFields({
  register,
  control,
  errors,
  isReadOnly,
}: EmpresaFormFieldsProps) {
  return (
    <>
      <SimpleGrid minChildWidth="240px" spacing="6" w="100%">
        <InputCustom
          name="razaoSocial"
          label="Razão Social"
          errors={errors}
          register={register}
          isReadOnly={isReadOnly}
        />
        <InputCustom
          name="fantasia"
          label="Nome Fantasia"
          errors={errors}
          register={register}
          isReadOnly={isReadOnly}
        />
        <InputCustom
          name="cnpj"
          label="CNPJ"
          errors={errors}
          control={control}
          masks={cnpjAlfanumericoMask}
          maxLength={18}
          isReadOnly={isReadOnly}
        />
      </SimpleGrid>

      <SimpleGrid minChildWidth="240px" spacing="6" w="100%">
        <InputCustom
          name="ie"
          label="Inscrição Estadual"
          errors={errors}
          register={register}
          isReadOnly={isReadOnly}
        />
        <InputCustom
          name="telefone"
          label="Telefone"
          errors={errors}
          control={control}
          masks={phoneMask}
          maxLength={13}
          isReadOnly={isReadOnly}
        />
        <InputCustom
          name="limiteCredito"
          label="Limite de Crédito (R$)"
          errors={errors}
          control={control}
          masks={currencyMask}
          isReadOnly={isReadOnly}
        />
      </SimpleGrid>

      <SimpleGrid minChildWidth="240px" spacing="6" w="100%">
        <InputCustom
          name="email"
          label="Email"
          errors={errors}
          register={register}
          isReadOnly={isReadOnly}
        />
        <InputCustom
          name="emailXmlNfe"
          label="Email XML NF-e"
          errors={errors}
          register={register}
          isReadOnly={isReadOnly}
        />
        <InputCustom
          name="segmento"
          label="Segmento"
          errors={errors}
          register={register}
          isReadOnly={isReadOnly}
        />
      </SimpleGrid>

      <SimpleGrid minChildWidth="240px" spacing="6" w="100%">
        <SelectCustom
          label="Status"
          name="statusEmpresa"
          register={register}
          errorMessage={errors.statusEmpresa?.message}
          isDisabled={isReadOnly}
          options={[
            { id: 'ATIVO', value: 'Ativo' },
            { id: 'INATIVO', value: 'Inativo' },
            { id: 'SUSPENSO', value: 'Suspenso' },
          ]}
          chave="value"
        />
        <InputCustom
          name="filial"
          label="Código Filial"
          errors={errors}
          register={register}
          maxLength={4}
          isReadOnly={isReadOnly}
        />
        <SelectCustom
          label="É matriz?"
          name="matriz"
          register={register}
          errorMessage={errors.matriz?.message}
          isDisabled={isReadOnly}
          options={[
            { id: 'true', value: 'Sim' },
            { id: 'false', value: 'Não' },
          ]}
          chave="value"
        />
      </SimpleGrid>

      <SimpleGrid minChildWidth="240px" spacing="6" w="100%">
        <InputCustom
          name="observacaoEmpresa"
          label="Observação"
          errors={errors}
          register={register}
          isReadOnly={isReadOnly}
        />
      </SimpleGrid>

      <Divider my="6" borderColor="gray.700" />
      <Text fontWeight="bold" mb={2}>
        Endereço
      </Text>
      <Text fontSize="sm" color="gray.400" mb={2}>
        A API ainda não devolve o endereço já cadastrado pra pré-preencher
        aqui. Deixe os campos abaixo em branco pra manter o endereço atual —
        só preencha se quiser realmente trocá-lo.
      </Text>

      <SimpleGrid minChildWidth="240px" spacing="6" w="100%">
        <InputCustom
          name="endereco.logradouro"
          label="Logradouro"
          errors={errors}
          register={register}
          isReadOnly={isReadOnly}
        />
        <InputCustom
          name="endereco.numero"
          label="Número"
          errors={errors}
          register={register}
          isReadOnly={isReadOnly}
        />
        <InputCustom
          name="endereco.complemento"
          label="Complemento"
          errors={errors}
          register={register}
          isReadOnly={isReadOnly}
        />
      </SimpleGrid>

      <SimpleGrid minChildWidth="240px" spacing="6" w="100%">
        <InputCustom
          name="endereco.bairro"
          label="Bairro"
          errors={errors}
          register={register}
          isReadOnly={isReadOnly}
        />
        <InputCustom
          name="endereco.cidade"
          label="Cidade"
          errors={errors}
          register={register}
          isReadOnly={isReadOnly}
        />
        <InputCustom
          name="endereco.uf"
          label="UF"
          errors={errors}
          register={register}
          maxLength={2}
          isReadOnly={isReadOnly}
        />
      </SimpleGrid>

      <SimpleGrid minChildWidth="240px" spacing="6" w="100%">
        <InputCustom
          name="endereco.cep"
          label="CEP"
          errors={errors}
          control={control}
          masks={cepMask}
          maxLength={9}
          isReadOnly={isReadOnly}
        />
        <InputCustom
          name="endereco.codigoIbge"
          label="Código IBGE"
          errors={errors}
          register={register}
          isReadOnly={isReadOnly}
        />
        <InputCustom
          name="endereco.pontoReferencia"
          label="Ponto de Referência"
          errors={errors}
          register={register}
          isReadOnly={isReadOnly}
        />
      </SimpleGrid>
    </>
  );
}
