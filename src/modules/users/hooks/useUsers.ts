import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userService } from '../services/userService';
import toast from 'react-hot-toast';

export function useUsers(params?: any) {
  return useQuery({ queryKey: ['users', params], queryFn: () => userService.getAll(params) });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: userService.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Usuario creado'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error al crear usuario'),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => userService.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Usuario actualizado'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error al actualizar usuario'),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => userService.changePassword(id, data),
    onSuccess: () => { toast.success('Contrasena actualizada'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error al cambiar contrasena'),
  });
}

export function useToggleUserStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: userService.toggleStatus,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Estado actualizado'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Error al cambiar estado'),
  });
}
