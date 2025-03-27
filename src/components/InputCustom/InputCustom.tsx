import {
  FormControl,
  FormLabel,
  Text,
  Input as InputChakra,
  InputProps as ChakraInputProps,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { Control, Controller, FieldValues } from "react-hook-form";

interface InputProps extends ChakraInputProps {
  name: string;
  label?: string;
  errors: any;
  register?: any;
  control?: Control<FieldValues, object>;
  masks?: (value: string) => string | undefined;
  isReadOnly?: boolean;
}
export function InputCustom({
  name,
  label,
  errors,
  register,
  control,
  masks,
  isReadOnly,
  ...rest
}: InputProps) {
  const [scope, setScope] = useState("");
  const [scopedName, setScopedName] = useState<any>("");
  useEffect(() => {
    if (errors.endereco || errors.usuario) {
      const [scopeTemp, scopedNameTemp] = name.split(".");

      if (scopedNameTemp) {
        setScope(scopeTemp);
        setScopedName(scopedNameTemp);
      }
    }
  }, [errors, name]);
  return (
    <FormControl>
      {!!label && <FormLabel htmlFor={name}>{label}</FormLabel>}

      {register ? (
        <InputChakra
          name={name}
          id={name}
          bgColor="gray.700"
          color={isReadOnly && "gray.300"}
          variant="filled"
          _hover={{
            bgColor: "gray.700",
          }}
          isReadOnly={isReadOnly}
          cursor={isReadOnly ? "not-allowed" : "default"}
          _focus={{
            bg: isReadOnly && "gray.700",
          }}
          {...register(name)}
          {...rest}
        />
      ) : (
        <Controller
          name={name}
          control={control}
          render={({ field }) => (
            <InputChakra
              value={(masks && masks(field.value)) || ""}
              onChange={(e) => masks && field.onChange(masks(e.target.value))}
              variant="filled"
              bgColor="gray.700"
              _hover={{
                bgColor: "gray.700",
              }}
              {...rest}
            />
          )}
        />
      )}

      {(errors.endereco && scope && scopedName && scope === "endereco") ||
      (errors.usuario && scope && scopedName && scope === "usuario") ? (
        <Text color="red">{errors[scope][scopedName]?.message}</Text>
      ) : (
        <Text color="red">{errors[name]?.message}</Text>
      )}
    </FormControl>
  );
}
